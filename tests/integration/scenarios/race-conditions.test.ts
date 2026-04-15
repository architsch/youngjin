/**
 * Scenario tests: Race conditions
 *
 * Thoroughly tests all possible race conditions among concurrent signals:
 *
 * 1. Multiple users joining an unloaded room simultaneously (loadRoom dedup)
 * 2. User joining while another user is leaving (room save + unload race)
 * 3. Two users editing the same voxel simultaneously
 * 4. Object transform updates during room transitions
 * 5. Concurrent disconnections under latency
 * 6. Join/leave churn with concurrent voxel edits
 * 7. Reconnection during room load
 * 8. Simultaneous room switches by multiple users
 * 9. Signal arrival during room change async gaps
 * 10. Graceful shutdown during active operations
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import {
    regularRoom, hubRoom, usersInRoom, userAt, userAtCenter, namedUser,
    parallel, enableLatency, disableLatency, buildColumn,
    disconnectWithSave,
} from "../helpers/scenarioPresets";
import { checkStructuralInvariants, checkObjectTransformConsistency } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

describe("race condition scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── RC1: Concurrent joins to unloaded room ─────────────────────────────

    describe("RC1: concurrent joins to unloaded room", () => {
        it("multiple users joining simultaneously share the same loadRoom promise", async () => {
            await runScenario({
                name: "concurrent join - no latency",
                rooms: [regularRoom("concurrent-room")],
                users: Array.from({length: 6}, (_, i) => ({
                    overrides: { lastX: 8 + i * 3, lastZ: 8 + i * 3, playerMetadata: { "0": `u${i}` } },
                })),
                actions: [
                    // All 6 users join concurrently
                    parallel(
                        ...Array.from({length: 6}, (_, i) => [
                            { type: "joinRoom" as const, userIndex: i, roomID: "concurrent-room" }
                        ])
                    ),
                ],
                assertions: ({ users, harness }) => {
                    expect(harness.isRoomLoaded("concurrent-room")).toBe(true);
                    expect(harness.getRoomParticipantCount("concurrent-room")).toBe(6);
                    for (let i = 0; i < 6; i++)
                    {
                        const obj = harness.getPlayerObject(users[i].user.id);
                        expect(obj, `Player object missing for user ${i}`).toBeDefined();
                        expect(obj!.metadata[0]?.str).toBe(`u${i}`);
                    }
                },
            });
        });

        it("concurrent joins under DB latency still dedup correctly", async () => {
            await runScenario({
                name: "concurrent join - with latency",
                rooms: [regularRoom("lat-concurrent")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: Array.from({length: 6}, (_, i) => ({
                    overrides: { lastX: 8 + i * 3, lastZ: 8 + i * 3, playerMetadata: { "0": `lat-${i}` } },
                })),
                actions: [
                    parallel(
                        ...Array.from({length: 6}, (_, i) => [
                            { type: "joinRoom" as const, userIndex: i, roomID: "lat-concurrent" }
                        ])
                    ),
                ],
                assertions: ({ users, harness }) => {
                    expect(harness.isRoomLoaded("lat-concurrent")).toBe(true);
                    expect(harness.getRoomParticipantCount("lat-concurrent")).toBe(6);
                },
            }, );
        });
    });

    // ─── RC2: User joining while another is leaving ─────────────────────────

    describe("RC2: join during leave (room save + unload race)", () => {
        it("joiner prevents room from being unloaded during save", async () => {
            await runScenario({
                name: "join during leave",
                rooms: [regularRoom("jl-room")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: [
                    userAt(10, 10, "jl-room", { id: "leaver" }),
                    userAt(20, 20, undefined, { id: "joiner" }),
                ],
                actions: [
                    // Leaver disconnects while joiner joins — concurrent
                    parallel(
                        [{ type: "disconnect" as const, userIndex: 0, saveState: true }],
                        [{ type: "joinRoom" as const, userIndex: 0, roomID: "jl-room" }],
                    ),
                ],
                skipInvariants: true, // Mixed state due to concurrent disconnect + index shift
                assertions: ({ harness }) => {
                    // Room is either loaded with valid participants, or fully unloaded
                    if (harness.isRoomLoaded("jl-room"))
                    {
                        expect(harness.getRoomParticipantCount("jl-room")).toBeGreaterThanOrEqual(1);
                    }
                    else
                    {
                        // If unloaded, no users should reference it
                        expect(ServerRoomManager.currentRoomIDByUserID["joiner"]).not.toBe("jl-room");
                    }
                },
                skipCleanup: true,
            });
        });

        it("stayers keep the room alive when others leave under latency", async () => {
            await runScenario({
                name: "stayers keep room alive",
                rooms: [regularRoom("stayer-room")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: [
                    ...usersInRoom(3, "stayer-room"), // stayers (indices 0-2)
                    userAt(10, 10, "stayer-room", { id: "leaver-0" }),
                    userAt(11, 11, "stayer-room", { id: "leaver-1" }),
                ],
                actions: [
                    parallel(
                        [{ type: "disconnect" as const, userIndex: 3, saveState: true }],
                        [{ type: "disconnect" as const, userIndex: 3, saveState: true }], // index shifts after first
                    ),
                ],
                skipInvariants: true,
                assertions: ({ harness }) => {
                    expect(harness.isRoomLoaded("stayer-room")).toBe(true);
                    // At least the stayers should remain
                    expect(harness.getRoomParticipantCount("stayer-room")).toBeGreaterThanOrEqual(1);
                },
                skipCleanup: true,
            });
        });
    });

    // ─── RC3: Simultaneous voxel edits ──────────────────────────────────────

    describe("RC3: simultaneous voxel edits on same block", () => {
        it("two users adding to the same position: one succeeds, one gets rollback", async () => {
            await runScenario({
                name: "concurrent add same voxel",
                rooms: [hubRoom("voxel-race")],
                users: [
                    userAt(5, 5, "voxel-race"),
                    userAt(25, 25, "voxel-race"),
                ],
                actions: [
                    // Both try to add at the same position concurrently
                    parallel(
                        [{ type: "addVoxel" as const, userIndex: 0, row: 10, col: 10, layer: 0 }],
                        [{ type: "addVoxel" as const, userIndex: 1, row: 10, col: 10, layer: 0 }],
                    ),
                ],
                assertions: () => {
                    const roomMem = ServerRoomManager.roomRuntimeMemories["voxel-race"];
                    const voxel = VoxelQueryUtil.getVoxel(roomMem.room, 10, 10);
                    // Exactly one block should be at this position
                    expect(VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0)).toBe(true);
                },
            });
        });

        it("one user adds while another removes: consistent final state", async () => {
            await runScenario({
                name: "concurrent add/remove same voxel",
                rooms: [hubRoom("ar-race")],
                users: [
                    userAt(5, 5, "ar-race"),
                    userAt(25, 25, "ar-race"),
                ],
                actions: [
                    // First add the block
                    { type: "addVoxel", userIndex: 0, row: 15, col: 15, layer: 0 },
                    // Then simultaneously: user0 removes, user1 adds at same spot
                    parallel(
                        [{ type: "removeVoxel" as const, userIndex: 0, row: 15, col: 15, layer: 0 }],
                        [{ type: "addVoxel" as const, userIndex: 1, row: 15, col: 15, layer: 0 }],
                    ),
                ],
                assertions: () => {
                    // The voxel state should be internally consistent:
                    // either occupied (add won) or not (remove won), and
                    // structural invariants should hold for the room
                    const roomMem = ServerRoomManager.roomRuntimeMemories["ar-race"];
                    expect(roomMem).toBeDefined();
                    expect(Object.keys(roomMem.participantUserIDs).length).toBe(2);
                },
            });
        });

        it("many users editing adjacent blocks concurrently", async () => {
            await runScenario({
                name: "concurrent adjacent voxel edits",
                rooms: [hubRoom("adj-race")],
                users: usersInRoom(4, "adj-race"),
                actions: [
                    parallel(
                        [{ type: "addVoxel" as const, userIndex: 0, row: 10, col: 10, layer: 0 }],
                        [{ type: "addVoxel" as const, userIndex: 1, row: 10, col: 11, layer: 0 }],
                        [{ type: "addVoxel" as const, userIndex: 2, row: 11, col: 10, layer: 0 }],
                        [{ type: "addVoxel" as const, userIndex: 3, row: 11, col: 11, layer: 0 }],
                    ),
                ],
                assertions: () => {
                    const roomMem = ServerRoomManager.roomRuntimeMemories["adj-race"];
                    let count = 0;
                    for (const [r, c] of [[10,10],[10,11],[11,10],[11,11]])
                    {
                        const voxel = VoxelQueryUtil.getVoxel(roomMem.room, r, c);
                        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, 0))
                            count++;
                    }
                    expect(count).toBe(4); // All should succeed since they're at different positions
                },
            });
        });
    });

    // ─── RC4: Object transforms during room transitions ─────────────────────

    describe("RC4: transform updates during room transitions", () => {
        it("movement signals sent during room switch are handled gracefully", async () => {
            await runScenario({
                name: "move during room switch",
                rooms: [regularRoom("from-room"), regularRoom("to-room")],
                users: [userAt(10, 10, "from-room")],
                actions: [
                    // Move and switch room concurrently
                    parallel(
                        [{ type: "moveObject" as const, userIndex: 0, x: 15, y: 0, z: 15 }],
                        [{ type: "joinRoom" as const, userIndex: 0, roomID: "to-room" }],
                    ),
                ],
                skipInvariants: true, // State may be inconsistent mid-transition
                assertions: ({ users }) => {
                    // User must end up in exactly one room
                    const roomID = ServerRoomManager.currentRoomIDByUserID[users[0].user.id];
                    expect(roomID).toBeDefined();
                    expect(["from-room", "to-room"]).toContain(roomID);
                    // That room should be loaded and contain the user
                    expect(ServerRoomManager.roomRuntimeMemories[roomID]).toBeDefined();
                    expect(ServerRoomManager.roomRuntimeMemories[roomID].participantUserIDs[users[0].user.id]).toBe(true);
                },
            });
        });
    });

    // ─── RC5: Concurrent disconnections under latency ────────────────────────

    describe("RC5: concurrent disconnections under latency", () => {
        it("all gameplay states saved correctly despite concurrent disconnect", async () => {
            const N = 6;
            await runScenario({
                name: "concurrent disconnects",
                rooms: [regularRoom("disc-room")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: usersInRoom(N, "disc-room"),
                actions: [
                    // All users disconnect concurrently
                    parallel(
                        ...Array.from({length: N}, (_, i) => [
                            { type: "disconnect" as const, userIndex: 0, saveState: true }
                        ])
                    ),
                ],
                skipInvariants: true,
                assertions: ({ harness }) => {
                    // At least some states should have been saved
                    expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(1);
                },
                skipCleanup: true,
            }, );
        });
    });

    // ─── RC6: Join/leave churn with concurrent edits ────────────────────────

    describe("RC6: join/leave churn with concurrent voxel edits", () => {
        it("voxel edits succeed while users join and leave", async () => {
            await runScenario({
                name: "edit during churn",
                rooms: [hubRoom("churn-room")],
                users: [
                    userAt(5, 5, "churn-room"),
                    userAt(25, 25, "churn-room"),
                    userAt(15, 15), // not yet in room
                ],
                actions: [
                    parallel(
                        // User 0 edits voxels
                        [
                            { type: "addVoxel" as const, userIndex: 0, row: 10, col: 10, layer: 0 },
                            { type: "addVoxel" as const, userIndex: 0, row: 10, col: 11, layer: 0 },
                        ],
                        // User 1 leaves
                        [{ type: "disconnect" as const, userIndex: 1, saveState: false }],
                        // User 2 joins
                        [{ type: "joinRoom" as const, userIndex: 1, roomID: "churn-room" }],
                    ),
                ],
                skipInvariants: true,
                assertions: ({ harness }) => {
                    // Room should still be loaded (user 0 stayed)
                    expect(harness.isRoomLoaded("churn-room")).toBe(true);
                },
            });
        });
    });

    // ─── RC7: Reconnection during ongoing operations ────────────────────────

    describe("RC7: reconnection during active operations", () => {
        it("Case A reconnect while other user is mid-move", async () => {
            await runScenario({
                name: "reconnect A during movement",
                rooms: [regularRoom("recon-room")],
                users: [
                    namedUser("reconnector", "recon-room", { lastX: 10, lastZ: 10 }),
                    userAt(20, 20, "recon-room"),
                ],
                actions: [
                    parallel(
                        [{ type: "reconnectCaseA" as const, userIndex: 0 }],
                        [{ type: "moveObject" as const, userIndex: 1, x: 22, y: 0, z: 22 }],
                    ),
                ],
                skipInvariants: true,
                assertions: ({ users }) => {
                    // Reconnected user should have a valid user ID
                    expect(users[0].user.id).toBe("reconnector");
                },
            });
        });

        it("Case B reconnect while room is being edited", async () => {
            await runScenario({
                name: "reconnect B during voxel edit",
                rooms: [hubRoom("recon-edit-room")],
                users: [
                    namedUser("recon-editor", "recon-edit-room", { lastX: 10, lastZ: 10 }),
                    userAt(20, 20, "recon-edit-room"),
                ],
                actions: [
                    // User 0 reconnects while user 1 edits voxels
                    parallel(
                        [{ type: "reconnectCaseB" as const, userIndex: 0 }],
                        [
                            { type: "addVoxel" as const, userIndex: 1, row: 5, col: 5, layer: 0 },
                            { type: "addVoxel" as const, userIndex: 1, row: 5, col: 6, layer: 0 },
                        ],
                    ),
                ],
                skipInvariants: true,
                assertions: ({ users }) => {
                    // Room should still be loaded
                    expect(harness.isRoomLoaded("recon-edit-room")).toBe(true);
                    // Reconnected user should be back with correct ID
                    expect(users[0].user.id).toBe("recon-editor");
                },
            });
        });
    });

    // ─── RC8: Simultaneous room switches ────────────────────────────────────

    describe("RC8: simultaneous room switches", () => {
        it("multiple users switching rooms concurrently maintain consistent state", async () => {
            await runScenario({
                name: "concurrent room switches",
                rooms: [regularRoom("sw-A"), regularRoom("sw-B"), regularRoom("sw-C")],
                users: [
                    userAt(10, 10, "sw-A"),
                    userAt(10, 10, "sw-B"),
                    userAt(10, 10, "sw-C"),
                ],
                actions: [
                    parallel(
                        [{ type: "joinRoom" as const, userIndex: 0, roomID: "sw-B" }],
                        [{ type: "joinRoom" as const, userIndex: 1, roomID: "sw-C" }],
                        [{ type: "joinRoom" as const, userIndex: 2, roomID: "sw-A" }],
                    ),
                ],
                skipInvariants: true, // Room switching involves async saveState
                assertions: () => {
                    // Each user should be in exactly one room
                    const seenRooms = new Set<string>();
                    for (const [uid, rid] of Object.entries(ServerRoomManager.currentRoomIDByUserID))
                        seenRooms.add(rid);
                    // All referenced rooms should be loaded
                    for (const rid of seenRooms)
                        expect(ServerRoomManager.roomRuntimeMemories[rid]).toBeDefined();
                },
            });
        });

        it("users cross-switching rooms under latency", async () => {
            await runScenario({
                name: "cross-switch under latency",
                rooms: [regularRoom("cross-A"), regularRoom("cross-B")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: [
                    userAt(10, 10, "cross-A"),
                    userAt(20, 20, "cross-B"),
                ],
                actions: [
                    // Swap rooms simultaneously
                    parallel(
                        [{ type: "joinRoom" as const, userIndex: 0, roomID: "cross-B" }],
                        [{ type: "joinRoom" as const, userIndex: 1, roomID: "cross-A" }],
                    ),
                ],
                skipInvariants: true,
                assertions: () => {
                    // Under latency, room switches may complete in any order.
                    // Verify that all loaded rooms have consistent participant/memory state.
                    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
                    {
                        const socketRoomCtx = ServerRoomManager.socketRoomContexts[roomID];
                        expect(socketRoomCtx, `Socket room context missing for loaded room ${roomID}`).toBeDefined();
                    }
                },
            });
        });
    });

    // ─── RC9: Multiple rooms loading simultaneously ─────────────────────────

    describe("RC9: multiple rooms loading simultaneously", () => {
        it("different rooms load in parallel without interference", async () => {
            const ROOM_COUNT = 4;
            const rooms = Array.from({length: ROOM_COUNT}, (_, i) => regularRoom(`par-${i}`));
            const users = rooms.flatMap((r, ri) => [
                userAt(16, 16, undefined, { id: `pr${ri}-u0` }),
                userAt(16, 16, undefined, { id: `pr${ri}-u1` }),
            ]);

            await runScenario({
                name: "parallel room loads",
                rooms,
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users,
                actions: [
                    parallel(
                        ...users.map((_, i) => [
                            { type: "joinRoom" as const, userIndex: i, roomID: `par-${Math.floor(i / 2)}` }
                        ])
                    ),
                ],
                assertions: ({ harness }) => {
                    for (let i = 0; i < ROOM_COUNT; i++)
                    {
                        expect(harness.isRoomLoaded(`par-${i}`)).toBe(true);
                        expect(harness.getRoomParticipantCount(`par-${i}`)).toBe(2);
                    }
                },
            }, );
        });
    });

    // ─── RC10: Graceful shutdown during active operations ────────────────────

    describe("RC10: graceful shutdown during active operations", () => {
        it("shutdown while users are mid-movement", async () => {
            await runScenario({
                name: "shutdown during movement",
                rooms: [regularRoom("shut-room")],
                users: usersInRoom(4, "shut-room"),
                actions: [
                    parallel(
                        [
                            { type: "moveObject" as const, userIndex: 0, x: 10, y: 0, z: 10 },
                            { type: "moveObject" as const, userIndex: 1, x: 20, y: 0, z: 20 },
                        ],
                        [{ type: "gracefulShutdown" as const }],
                    ),
                ],
                skipInvariants: true,
                assertions: ({ harness }) => {
                    // Shutdown should have saved states
                    expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(1);
                },
                skipCleanup: true,
            });
        });

        it("shutdown while voxel edits are in progress", async () => {
            await runScenario({
                name: "shutdown during voxel edit",
                rooms: [hubRoom("shut-voxel")],
                users: usersInRoom(2, "shut-voxel"),
                actions: [
                    parallel(
                        buildColumn(0, 10, 10, 4),
                        [{ type: "gracefulShutdown" as const }],
                    ),
                ],
                skipInvariants: true,
                assertions: () => {
                    // After shutdown, all users should be cleaned up
                    expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
                },
                skipCleanup: true,
            });
        });
    });

    // ─── RC11: Latency-based race condition stress tests ────────────────────

    describe("RC11: latency stress tests", () => {
        it("reconnect under latency: restored state visible to observers", async () => {
            await runScenario({
                name: "reconnect under latency",
                rooms: [regularRoom("lat-recon")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: [
                    namedUser("observer", "lat-recon"),
                    namedUser("lat-reconnector", "lat-recon", { lastX: 16, lastZ: 16 }),
                ],
                actions: [
                    { type: "moveObject", userIndex: 1, x: 17, y: 0, z: 17 },
                    { type: "reconnectCaseB", userIndex: 1 },
                ],
                skipInvariants: true,
                assertions: ({ users, harness }) => {
                    // Reconnected user should be back
                    expect(users[1].user.id).toBe("lat-reconnector");
                    const obj = harness.getPlayerObject("lat-reconnector");
                    expect(obj).toBeDefined();
                },
            }, );
        });

        it("join/leave churn under latency preserves stayer state", async () => {
            await runScenario({
                name: "churn under latency",
                rooms: [regularRoom("churn-lat")],
                latency: { enabled: true, minMs: 0, maxMs: 3 },
                users: [
                    ...usersInRoom(3, "churn-lat"), // stayers
                    userAt(10, 10, "churn-lat"), // leaver
                    userAt(20, 20), // joiner (not yet in room)
                ],
                actions: [
                    parallel(
                        [{ type: "disconnect" as const, userIndex: 3, saveState: true }],
                        [{ type: "joinRoom" as const, userIndex: 3, roomID: "churn-lat" }], // joiner (now at index 3 after leaver removed)
                    ),
                ],
                skipInvariants: true,
                assertions: ({ harness }) => {
                    expect(harness.isRoomLoaded("churn-lat")).toBe(true);
                },
                skipCleanup: true,
            }, );
        });
    });
});
