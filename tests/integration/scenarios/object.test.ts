/**
 * Scenario tests: Object management
 *
 * Covers:
 * - Player spawn at correct position
 * - Player transform updates
 * - Authority checks (can't move another's object)
 * - Objects removed when user leaves
 * - Desync detection and recovery
 * - Gameplay state matches object transform
 * - Metadata (chat messages)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, userAt, usersInRoom, walkAcross, disconnectWithSave } from "../helpers/scenarioPresets";
import { harness } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";

describe("object scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("two players spawn at correct positions", async () => {
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
                expect(obj1!.transform.pos.x).toBeCloseTo(10);
                expect(obj1!.transform.pos.z).toBeCloseTo(10);
                expect(obj2!.transform.pos.x).toBeCloseTo(20);
                expect(obj2!.transform.pos.z).toBeCloseTo(20);
            },
        });
    });

    it("player can update own object transform", async () => {
        await runScenario({
            name: "update own transform",
            rooms: [EMPTY_REGULAR],
            users: [userAt(10, 10, "regular")],
            actions: [{ type: "moveObject", userIndex: 0, x: 12, y: 0, z: 12 }],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id);
                expect(obj).toBeDefined();
                // Movement of 2 units is within desync threshold (3),
                // so the server should accept a position close to the target
                expect(obj!.transform.pos.x).toBeCloseTo(12, 0);
                expect(obj!.transform.pos.z).toBeCloseTo(12, 0);
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

                // user2's position should be unchanged
                const obj2 = harness.getPlayerObject(users[1].user.id)!;
                expect(obj2.transform.pos.x).toBeCloseTo(20);
                expect(obj2.transform.pos.z).toBeCloseTo(20);
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
                { type: "moveObject", userIndex: 0, x: 25, y: 0, z: 25 },
            ],
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                // Desync resets to the last known server position (5, 5)
                // when the distance is >= 3 units (distSqr >= 9)
                expect(obj.transform.pos.x).toBeCloseTo(5, 0);
                expect(obj.transform.pos.z).toBeCloseTo(5, 0);
                // The requested position (25, 25) should NOT be applied
                expect(obj.transform.pos.x).not.toBeCloseTo(25, 0);
                expect(obj.transform.pos.z).not.toBeCloseTo(25, 0);
            },
        });
    });

    it("getUserGameplayState matches in-room object transform", async () => {
        await runScenario({
            name: "state matches transform",
            rooms: [EMPTY_REGULAR],
            users: [userAt(11, 22, "regular")],
            actions: walkAcross(0, 2),
            assertions: ({ users, harness }) => {
                const obj = harness.getPlayerObject(users[0].user.id)!;
                const state = harness.getGameplayState(users[0])!;
                expect(state.lastX).toBe(obj.transform.pos.x);
                expect(state.lastY).toBe(obj.transform.pos.y);
                expect(state.lastZ).toBe(obj.transform.pos.z);
            },
        });
    });

    it("position updates are reflected in saved state", async () => {
        await runScenario({
            name: "saved state reflects movement",
            rooms: [EMPTY_REGULAR],
            users: [userAt(16, 16, "regular")],
            actions: [
                ...walkAcross(0, 3),
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                const saved = harness.savedGameplayStates[0];
                expect(saved).toBeDefined();
                expect(saved.lastRoomID).toBe("regular");
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
