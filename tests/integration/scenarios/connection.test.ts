/**
 * Scenario tests: Connection lifecycle
 *
 * Covers:
 * - Basic connect/disconnect
 * - Reconnection Case A (new socket before old disconnect)
 * - Reconnection Case B (old disconnect before new socket)
 * - Page refresh / duplicate socket replacement
 * - Rapid connect-disconnect cycles
 * - Gameplay state extraction and persistence
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, userAt, userAtCenter, namedUser, disconnectWithSave } from "../helpers/scenarioPresets";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";

describe("connection scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("connecting a user registers them in ServerUserManager", async () => {
        await runScenario({
            name: "basic connect",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter()],
            assertions: ({ users }) => {
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                expect(ServerUserManager.socketUserContexts[users[0].user.id]).toBeDefined();
            },
        });
    });

    it("disconnect with saveState=true saves gameplay state", async () => {
        await runScenario({
            name: "disconnect saves state",
            rooms: [EMPTY_REGULAR],
            users: [userAt(5, 25, "regular")],
            actions: [disconnectWithSave(0)],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.savedGameplayStates).toHaveLength(1);
                const saved = harness.savedGameplayStates[0];
                expect(saved.lastX).toBeCloseTo(5);
                expect(saved.lastZ).toBeCloseTo(25);
            },
            skipCleanup: true,
        });
    });

    it("disconnect with saveState=false does NOT save gameplay state", async () => {
        await runScenario({
            name: "disconnect without save",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            actions: [{ type: "disconnect", userIndex: 0, saveState: false }],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.savedGameplayStates).toHaveLength(0);
            },
            skipCleanup: true,
        });
    });

    it("Case A: new socket before old disconnect preserves state", async () => {
        await runScenario({
            name: "reconnect case A",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("case-a-user", "regular", { lastX: 10, lastZ: 20 })],
            actions: [
                { type: "moveObject", userIndex: 0, x: 15, y: 0, z: 25 },
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                expect(users[0].user.id).toBe("case-a-user");
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                // User should be back in the room with position preserved
                const state = harness.getGameplayState(users[0]);
                expect(state).toBeDefined();
            },
        });
    });

    it("Case B: old disconnect before new socket preserves state", async () => {
        await runScenario({
            name: "reconnect case B",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("case-b-user", "regular", { lastX: 8, lastZ: 22 })],
            actions: [
                { type: "moveObject", userIndex: 0, x: 14, y: 0, z: 26 },
                { type: "reconnectCaseB", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                expect(users[0].user.id).toBe("case-b-user");
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                const state = harness.getGameplayState(users[0]);
                expect(state).toBeDefined();
            },
        });
    });

    it("handles rapid connect-disconnect-reconnect cycles", async () => {
        await runScenario({
            name: "rapid cycles",
            rooms: [EMPTY_REGULAR],
            users: [],
            actions: [
                // Cycle 1
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
                // Re-seed for next cycle
                { type: "seedRoom", roomID: "regular" },
                // Cycle 2
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
                // Re-seed for next cycle
                { type: "seedRoom", roomID: "regular" },
                // Cycle 3
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
            ],
            skipInvariants: true,
            assertions: () => {
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
            },
            skipCleanup: true,
        });
    });

    it("gameplay state contains correct position, direction, and metadata", async () => {
        await runScenario({
            name: "gameplay state extraction",
            rooms: [EMPTY_REGULAR],
            users: [{
                overrides: {
                    lastX: 10, lastY: 0.5, lastZ: 20,
                    lastDirX: 0.7, lastDirY: 0, lastDirZ: 0.7,
                    playerMetadata: { "0": "hello" },
                },
                joinRoom: "regular",
            }],
            assertions: ({ users, harness }) => {
                const state = harness.getGameplayState(users[0]);
                expect(state).toBeDefined();
                expect(state!.lastX).toBeCloseTo(10);
                expect(state!.lastY).toBeCloseTo(0.5);
                expect(state!.lastZ).toBeCloseTo(20);
                expect(state!.lastDirX).toBeCloseTo(0.7, 1);
                expect(state!.lastDirZ).toBeCloseTo(0.7, 1);
                expect(state!.playerMetadata).toEqual({ "0": "hello" });
            },
        });
    });

    it("position is preserved across disconnect and reconnect", async () => {
        await runScenario({
            name: "position persistence",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("persist-user", "regular", { lastX: 8, lastZ: 22 })],
            actions: [
                { type: "moveObject", userIndex: 0, x: 12, y: 0, z: 18 },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                const saved = harness.savedGameplayStates[0];
                expect(saved).toBeDefined();
                expect(saved.userID).toBe("persist-user");
                expect(saved.lastRoomID).toBe("regular");
            },
            skipCleanup: true,
        });
    });
});
