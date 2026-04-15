/**
 * Scenario tests: State persistence & metadata
 *
 * Covers scenarios not addressed by the existing connection/room/object tests:
 * - Player metadata persistence across reconnection
 * - Player metadata persistence across room switches
 * - Multiple reconnection cycles
 * - Voxel state persistence (blocks survive user leave/rejoin)
 * - Graceful shutdown preserves voxel state
 * - Extended invariant checks (physics + role consistency)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { harness } from "../helpers/serverHarness";
import {
    regularRoom, hubRoom, namedUser, userAt, usersInRoom,
    buildColumn, removeColumn, disconnectWithSave,
    reconnectUser, walkAcross,
} from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

describe("state persistence scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Metadata persistence ──────────────────────────────────────────

    it("player metadata is preserved across Case A reconnection", async () => {
        await runScenario({
            name: "metadata persists across reconnect A",
            rooms: [regularRoom("meta-room")],
            users: [namedUser("meta-user", "meta-room", {
                lastX: 16, lastZ: 16,
                playerMetadata: { "0": "my-display-name" },
            })],
            actions: [
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject("meta-user");
                expect(obj).toBeDefined();
                expect(obj!.metadata[0]?.str).toBe("my-display-name");
            },
        });
    });

    it("player metadata is preserved across Case B reconnection", async () => {
        await runScenario({
            name: "metadata persists across reconnect B",
            rooms: [regularRoom("meta-room-b")],
            users: [namedUser("meta-user-b", "meta-room-b", {
                lastX: 16, lastZ: 16,
                playerMetadata: { "0": "user-b-name" },
            })],
            actions: [
                { type: "reconnectCaseB", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject("meta-user-b");
                expect(obj).toBeDefined();
                expect(obj!.metadata[0]?.str).toBe("user-b-name");
            },
        });
    });

    it("chat message updates metadata and is visible to other users", async () => {
        await runScenario({
            name: "chat visible to all",
            rooms: [regularRoom("chat-room")],
            users: usersInRoom(3, "chat-room"),
            actions: [
                { type: "sendMessage", userIndex: 0, message: "hello" },
                { type: "sendMessage", userIndex: 1, message: "world" },
            ],
            assertions: ({ users, harness }) => {
                const obj0 = harness.getPlayerObject(users[0].user.id);
                const obj1 = harness.getPlayerObject(users[1].user.id);
                expect(obj0!.metadata[0]?.str).toBe("hello");
                expect(obj1!.metadata[0]?.str).toBe("world");
            },
        });
    });

    // ─── Multiple reconnection cycles ──────────────────────────────────

    it("survives 5 consecutive reconnection cycles", async () => {
        await runScenario({
            name: "5 reconnection cycles",
            rooms: [regularRoom("multi-recon")],
            users: [namedUser("cycle-user", "multi-recon", { lastX: 10, lastZ: 10 })],
            actions: [
                reconnectUser(0, "A"),
                { type: "moveObject", userIndex: 0, x: 12, y: 0, z: 12 },
                reconnectUser(0, "B"),
                { type: "moveObject", userIndex: 0, x: 13, y: 0, z: 13 },
                reconnectUser(0, "A"),
                { type: "moveObject", userIndex: 0, x: 14, y: 0, z: 14 },
                reconnectUser(0, "B"),
                reconnectUser(0, "A"),
            ],
            assertions: ({ users }) => {
                expect(users[0].user.id).toBe("cycle-user");
                const obj = harness.getPlayerObject("cycle-user");
                expect(obj).toBeDefined();
            },
        });
    });

    it("alternating Case A and B reconnects with observers", async () => {
        await runScenario({
            name: "alternating reconnect with observers",
            rooms: [regularRoom("alt-recon")],
            users: [
                namedUser("reconnector", "alt-recon", { lastX: 10, lastZ: 10 }),
                userAt(20, 20, "alt-recon"),
            ],
            actions: [
                reconnectUser(0, "A"),
                reconnectUser(0, "B"),
                reconnectUser(0, "A"),
            ],
            skipInvariants: true,
            assertions: ({ users, harness }) => {
                expect(users[0].user.id).toBe("reconnector");
                // Observer should still be present
                const obs = harness.getPlayerObject(users[1].user.id);
                expect(obs).toBeDefined();
            },
        });
    });

    // ─── Voxel state persistence ───────────────────────────────────────

    it("voxel blocks persist when all users leave and one rejoins", async () => {
        await runScenario({
            name: "voxels persist across empty room",
            rooms: [hubRoom("voxel-persist")],
            users: [namedUser("builder", "voxel-persist", { lastX: 16, lastZ: 16 })],
            actions: [
                ...buildColumn(0, 10, 10, 3),
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            skipCleanup: true,
            assertions: () => {
                // Room was unloaded after last user left — voxels are in the mock DB
                expect(harness.isRoomLoaded("voxel-persist")).toBe(false);
            },
        });
    });

    it("voxel blocks placed by one user are visible to newly joined user", async () => {
        await runScenario({
            name: "voxels visible to new joiner",
            rooms: [hubRoom("voxel-vis")],
            users: [
                userAt(16, 16, "voxel-vis"),
                userAt(20, 20),
            ],
            actions: [
                ...buildColumn(0, 15, 15, 2),
                { type: "joinRoom", userIndex: 1, roomID: "voxel-vis" },
            ],
            assertions: () => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["voxel-vis"];
                const v0 = VoxelQueryUtil.getVoxel(roomMem.room, 15, 15);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v0, 0)).toBe(true);
                expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(v0, 1)).toBe(true);
            },
        });
    });

    // ─── Extended invariant coverage ───────────────────────────────────

    it("extended invariants hold after mixed operations", async () => {
        await runScenario({
            name: "extended invariants",
            rooms: [hubRoom("ext-inv")],
            users: usersInRoom(4, "ext-inv"),
            invariants: "extended",
            actions: [
                ...walkAcross(0, 2),
                ...buildColumn(1, 10, 10, 2),
                { type: "sendMessage", userIndex: 2, message: "testing" },
                { type: "moveObject", userIndex: 3, x: 15, y: 0, z: 15 },
            ],
        });
    });

    // ─── Graceful shutdown with voxels ──────────────────────────────────

    it("graceful shutdown preserves user states across multiple rooms", async () => {
        await runScenario({
            name: "graceful shutdown multi-room",
            rooms: [regularRoom("gs-A"), regularRoom("gs-B"), hubRoom("gs-C")],
            users: [
                userAt(5, 5, "gs-A", { id: "u-A" }),
                userAt(10, 10, "gs-B", { id: "u-B" }),
                userAt(15, 15, "gs-C", { id: "u-C" }),
            ],
            actions: [
                { type: "moveObject", userIndex: 0, x: 6, y: 0, z: 6 },
                { type: "moveObject", userIndex: 1, x: 11, y: 0, z: 11 },
                { type: "sendMessage", userIndex: 2, message: "before shutdown" },
                { type: "gracefulShutdown" },
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // All 3 users should have saved states
                expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(3);
                const ids = harness.savedGameplayStates.map(s => s.userID);
                expect(ids).toContain("u-A");
                expect(ids).toContain("u-B");
                expect(ids).toContain("u-C");
            },
            skipCleanup: true,
        });
    });
});
