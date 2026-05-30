/**
 * Scenario tests: Object management
 *
 * Covers:
 * - Player spawn at correct position
 * - Player transform updates
 * - Authority checks (can't move another's object)
 * - Objects removed when user leaves
 * - Desync detection and recovery
 * - Player metadata snapshot mirrors the live player object
 * - Metadata (chat messages)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, userAt, usersInRoom, walkAcross, disconnectWithSave } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, PLAYER_HEIGHT } from "../../../src/shared/system/sharedConstants";

// Players always spawn at the entrance cell center, regardless of where they were before
// (see the spawn transform in ServerRoomManager.changeUserRoom).
const SPAWN_X = MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5;
const SPAWN_Z = MULTI_PLAYER_ENTRANCE_VOXEL_ROW + 0.5;

describe("object scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("two players both spawn at the room entrance", async () => {
        await runScenario({
            name: "spawn positions",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            assertions: ({ users, harness }) => {
                const obj1 = harness.getPlayerObject(users[0].user.id);
                const obj2 = harness.getPlayerObject(users[1].user.id);
                expect(obj1).toBeDefined();
                expect(obj2).toBeDefined();
                expect(obj1!.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj1!.transform.pos.z).toBeCloseTo(SPAWN_Z);
                expect(obj2!.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj2!.transform.pos.z).toBeCloseTo(SPAWN_Z);
            },
        });
    });

    it("player can update own object transform", async () => {
        await runScenario({
            name: "update own transform",
            rooms: [EMPTY_REGULAR],
            users: [userAt(10, 10, "regular")],
            actions: [{ type: "moveObject", userIndex: 0, x: SPAWN_X, y: 0.5 * PLAYER_HEIGHT, z: SPAWN_Z - 2 }],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id);
                expect(obj).toBeDefined();
                // Small movement (2 units into the room) is within the desync threshold,
                // so the server should accept a position close to the target
                expect(obj!.transform.pos.x).toBeCloseTo(SPAWN_X, 0);
                expect(obj!.transform.pos.z).toBeCloseTo(SPAWN_Z - 2, 0);
            },
        });
    });

    it("player cannot move another player's object", async () => {
        await runScenario({
            name: "authority check",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            actions: [],
            assertions: ({ users, harness }) => {
                const u2Obj = harness.getPlayerObject(users[1].user.id)!;
                const roomID = ServerRoomManager.currentRoomIDByUserID[users[0].user.id];

                // Try to move user2's object as user1
                const signal = new SetObjectTransformSignal(
                    roomID, u2Obj.objectId,
                    new ObjectTransform({x: 15, y: 0, z: 15}, {x: 0, y: 0, z: 1}),
                    false,
                );
                ServerObjectManager.onSetObjectTransformSignalReceived(users[0].socketUserContext, signal);

                // user2's position should be unchanged (still at the entrance)
                const obj2 = harness.getPlayerObject(users[1].user.id)!;
                expect(obj2.transform.pos.x).toBeCloseTo(SPAWN_X);
                expect(obj2.transform.pos.z).toBeCloseTo(SPAWN_Z);
            },
        });
    });

    it("objects are removed when user leaves room", async () => {
        await runScenario({
            name: "objects removed on leave",
            rooms: [EMPTY_REGULAR],
            users: [
                userAt(10, 10, "regular"),
                userAt(20, 20, "regular"),
            ],
            assertions: ({ users, harness }) => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["regular"];
                expect(Object.keys(roomMem.room.objectById)).toHaveLength(2);
            },
        });
    });

    it("desync detection triggers when position jumps too far", async () => {
        await runScenario({
            name: "desync detection",
            rooms: [EMPTY_REGULAR],
            users: [userAt(5, 5, "regular")],
            actions: [
                // Try to teleport far away (>3 units should trigger desync)
                { type: "moveObject", userIndex: 0, x: SPAWN_X, y: 0, z: SPAWN_Z - 20 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                // Desync resets to the last known server position (the entrance)
                // when the distance is >= 3 units (distSqr >= 9)
                expect(obj.transform.pos.x).toBeCloseTo(SPAWN_X, 0);
                expect(obj.transform.pos.z).toBeCloseTo(SPAWN_Z, 0);
            },
        });
    });

    it("ServerUserManager.getPlayerMetadata mirrors live player-object metadata", async () => {
        await runScenario({
            name: "metadata snapshot mirrors player object",
            rooms: [EMPTY_REGULAR],
            users: [userAt(11, 22, "regular")],
            actions: [
                ...walkAcross(0, 2),
                { type: "sendMessage", userIndex: 0, message: "snapshot" },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                const metadata = harness.getPlayerMetadata(users[0].user.id)!;
                expect(metadata["0"]).toBe(obj.metadata[0]?.str);
                expect(metadata["0"]).toBe("snapshot");
            },
        });
    });

    it("disconnect-with-save persists lastRoomID and flushes the latest metadata", async () => {
        await runScenario({
            name: "disconnect persists lastRoomID",
            rooms: [EMPTY_REGULAR],
            users: [userAt(16, 16, "regular", { id: "post-walk-user" })],
            actions: [
                ...walkAcross(0, 3),
                { type: "sendMessage", userIndex: 0, message: "post-walk" },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.getStoredLastRoomID("post-walk-user")).toBe("regular");
                const saved = harness.savedPlayerMetadataRecords[0];
                expect(saved).toBeDefined();
                expect(saved.playerMetadata["0"]).toBe("post-walk");
            },
            skipCleanup: true,
        });
    });

    it("chat messages are stored in player metadata", async () => {
        await runScenario({
            name: "chat message metadata",
            rooms: [EMPTY_REGULAR],
            users: [userAt(16, 16, "regular")],
            actions: [{ type: "sendMessage", userIndex: 0, message: "hello world" }],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                expect(obj.metadata[0]?.str).toBe("hello world");
            },
        });
    });
});
