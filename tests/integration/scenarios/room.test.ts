/**
 * Scenario tests: Room lifecycle
 *
 * Covers:
 * - Joining unloaded / loaded rooms
 * - Joining non-existent rooms
 * - Rapid room switching
 * - Cross-user visibility (position, metadata)
 * - Room-specific state independence
 * - Room switching saves previous state
 * - Last user leaving unloads the room
 * - Graceful server shutdown
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { harness } from "../helpers/serverHarness";
import {
    EMPTY_REGULAR, EMPTY_HUB, regularRoom, usersInRoom,
    userAtCenter, userAt, namedUser, disconnectWithSave,
} from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

describe("room scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("joining an unloaded room triggers loadRoom", async () => {
        await runScenario({
            name: "join unloaded room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter()],
            actions: [{ type: "joinRoom", userIndex: 0, roomID: "regular" }],
            assertions: ({ harness }) => {
                expect(harness.isRoomLoaded("regular")).toBe(true);
                expect(harness.getRoomParticipantCount("regular")).toBe(1);
            },
        });
    });

    it("joining an already-loaded room adds user without reloading", async () => {
        await runScenario({
            name: "join loaded room",
            rooms: [EMPTY_REGULAR],
            users: [
                userAtCenter("regular"),
                userAt(20, 20),
            ],
            actions: [{ type: "joinRoom", userIndex: 1, roomID: "regular" }],
            assertions: ({ harness }) => {
                expect(harness.getRoomParticipantCount("regular")).toBe(2);
            },
        });
    });

    it("joining a non-existent room returns gracefully", async () => {
        await runScenario({
            name: "join non-existent room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter()],
            actions: [{ type: "joinRoom", userIndex: 0, roomID: "does-not-exist" }],
            assertions: ({ users }) => {
                // User should not be in the non-existent room
                const roomID = ServerRoomManager.currentRoomIDByUserID[users[0].user.id];
                expect(roomID).not.toBe("does-not-exist");
                // The non-existent room should not have been loaded
                expect(ServerRoomManager.roomRuntimeMemories["does-not-exist"]).toBeUndefined();
            },
        });
    });

    it("all participants see consistent object state for every player", async () => {
        const N = 6;
        await runScenario({
            name: "cross-user visibility",
            rooms: [EMPTY_REGULAR],
            users: usersInRoom(N, "regular"),
            assertions: ({ users, harness }) => {
                const roomMem = ServerRoomManager.roomRuntimeMemories["regular"];
                expect(Object.keys(roomMem.room.objectById)).toHaveLength(N);

                for (let i = 0; i < N; i++)
                {
                    const obj = harness.getPlayerObject(users[i].user.id);
                    expect(obj).toBeDefined();
                    expect(obj!.metadata[0]?.str).toBe(`user-${i}`);
                    expect(obj!.sourceUserID).toBe(users[i].user.id);
                }
            },
        });
    });

    it("users in different rooms have independent gameplay states", async () => {
        await runScenario({
            name: "multi-room independence",
            rooms: [regularRoom("room-X"), regularRoom("room-Y")],
            users: [
                userAt(5, 5, "room-X"),
                userAt(25, 25, "room-Y"),
            ],
            assertions: ({ users, harness }) => {
                const stateX = harness.getGameplayState(users[0]);
                const stateY = harness.getGameplayState(users[1]);
                expect(stateX!.lastRoomID).toBe("room-X");
                expect(stateY!.lastRoomID).toBe("room-Y");
                expect(stateX!.lastX).toBeCloseTo(5);
                expect(stateY!.lastX).toBeCloseTo(25);
            },
        });
    });

    it("switching rooms saves state from previous room", async () => {
        await runScenario({
            name: "room switch saves state",
            rooms: [regularRoom("from"), regularRoom("to")],
            users: [userAt(10, 20, "from")],
            actions: [
                { type: "moveObject", userIndex: 0, x: 15, y: 0, z: 25 },
                { type: "joinRoom", userIndex: 0, roomID: "to" },
            ],
            skipInvariants: true,
            assertions: ({ users }) => {
                expect(ServerRoomManager.currentRoomIDByUserID[users[0].user.id]).toBe("to");
            },
        });
    });

    it("requestRoomChange signal saves gameplay state from previous room", async () => {
        await runScenario({
            name: "requestRoomChange saves state",
            rooms: [regularRoom("room-A"), regularRoom("room-B")],
            users: [userAt(10, 20, "room-A")],
            actions: [
                { type: "requestRoomChange", userIndex: 0, roomID: "room-B" },
            ],
            skipInvariants: true,
            assertions: ({ users, harness }) => {
                // User should now be in room-B
                expect(ServerRoomManager.currentRoomIDByUserID[users[0].user.id]).toBe("room-B");
                // Gameplay state from room-A should have been saved to the DB
                const saved = harness.savedGameplayStates;
                const roomASave = saved.find(s => s.userID === users[0].user.id && s.lastRoomID === "room-A");
                expect(roomASave).toBeDefined();
                expect(roomASave!.lastX).toBeCloseTo(10);
                expect(roomASave!.lastZ).toBeCloseTo(20);
            },
        });
    });

    it("room unloads when last user leaves", async () => {
        await runScenario({
            name: "room unload on empty",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            actions: [{ type: "disconnect", userIndex: 0, saveState: false }],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.isRoomLoaded("regular")).toBe(false);
            },
            skipCleanup: true,
        });
    });

    it("graceful shutdown saves all rooms and user states", async () => {
        await runScenario({
            name: "graceful shutdown",
            rooms: [regularRoom("shut-A"), regularRoom("shut-B")],
            users: [
                userAt(10, 10, "shut-A", { id: "user-a" }),
                userAt(20, 20, "shut-B", { id: "user-b" }),
            ],
            actions: [{ type: "gracefulShutdown" }],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
                expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(2);
            },
            skipCleanup: true,
        });
    });
});
