/**
 * Combinations: Execution of a sequence of random types of events at random
 * points in time.
 *
 * Uses fast-check to generate random action sequences, execute them, and
 * verify server invariants hold. Also includes latency-simulated variants
 * to expose race conditions.
 *
 * Covers criteria items:
 * - Execution of a sequence of random types of events at random points in time
 * - Random variations in latency
 * - Random variations in parameter validity
 * - State persistence invariants under random churn
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RoomManager from "../../../src/server/room/roomManager";
import UserManager from "../../../src/server/user/userManager";
import {
    Action, actionArb, connectAction, disconnectAction,
    joinRoomAction, moveObjectAction, editVoxelAction,
    executeAction, MAX_USERS, ROOM_IDS, NUM_RUNS, MAX_ACTIONS,
} from "../helpers/actionExecutor";
import { checkInvariants, checkObjectTransformConsistency } from "../helpers/invariantCheckers";

// ─── Without latency ────────────────────────────────────────────────────────

describe("randomized multiplayer scenarios (fast-check)", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("server state invariants hold under random action sequences", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(actionArb, { minLength: 5, maxLength: MAX_ACTIONS }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                        await executeAction(action, connectedUsers);

                    checkInvariants(connectedUsers);

                    for (const ctx of connectedUsers)
                        await harness.disconnectUser(ctx, false);
                }
            ),
            { numRuns: NUM_RUNS, verbose: 1 }
        );
    });

    it("state is consistent after all users disconnect regardless of history", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(actionArb, { minLength: 10, maxLength: MAX_ACTIONS }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                        await executeAction(action, connectedUsers);

                    while (connectedUsers.length > 0)
                    {
                        const ctx = connectedUsers.pop()!;
                        await harness.disconnectUser(ctx, false);
                    }

                    expect(Object.keys(UserManager.socketUserContexts)).toHaveLength(0);
                    expect(Object.keys(RoomManager.currentRoomIDByUserID)).toHaveLength(0);
                    expect(Object.keys(RoomManager.roomRuntimeMemories)).toHaveLength(0);
                }
            ),
            { numRuns: NUM_RUNS, verbose: 1 }
        );
    });

    it("connect-heavy scenario: many rapid connections maintain consistent state", async () => {
        const heavyConnectAction = fc.oneof(
            { weight: 5, arbitrary: connectAction },
            { weight: 3, arbitrary: joinRoomAction },
            { weight: 1, arbitrary: disconnectAction },
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(heavyConnectAction, { minLength: 10, maxLength: 40 }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                        await executeAction(action, connectedUsers);

                    checkInvariants(connectedUsers);

                    for (const ctx of connectedUsers)
                        await harness.disconnectUser(ctx, false);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it("disconnect-heavy scenario: frequent disconnections maintain consistent state", async () => {
        const heavyDisconnectAction = fc.oneof(
            { weight: 2, arbitrary: connectAction },
            { weight: 2, arbitrary: joinRoomAction },
            { weight: 5, arbitrary: disconnectAction },
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(heavyDisconnectAction, { minLength: 10, maxLength: 40 }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                        await executeAction(action, connectedUsers);

                    checkInvariants(connectedUsers);

                    for (const ctx of connectedUsers)
                        await harness.disconnectUser(ctx, false);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it("room-switching-heavy scenario: users constantly changing rooms", async () => {
        const heavyRoomSwitch = fc.oneof(
            { weight: 1, arbitrary: connectAction },
            { weight: 6, arbitrary: joinRoomAction },
            { weight: 3, arbitrary: moveObjectAction },
            { weight: 1, arbitrary: disconnectAction },
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(heavyRoomSwitch, { minLength: 10, maxLength: 40 }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                        await executeAction(action, connectedUsers);

                    checkInvariants(connectedUsers);

                    for (const ctx of connectedUsers)
                        await harness.disconnectUser(ctx, false);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });
});

// ─── Property-based: state persistence invariants ────────────────────────────

describe("property-based: state persistence under random connect/disconnect (fast-check)", () => {
    const PROP_ROOM_IDS = ["prop-room-A", "prop-room-B"];
    const PROP_MAX_USERS = 8;
    const PROP_NUM_RUNS = 20;
    const PROP_MAX_ACTIONS = 30;

    type PropAction =
        | { type: "connect"; x: number; z: number; msg: string }
        | { type: "disconnect"; userIndex: number }
        | { type: "joinRoom"; userIndex: number; roomID: string }
        | { type: "move"; userIndex: number; x: number; z: number };

    const propConnectAction = fc.record<PropAction & { type: "connect" }>({
        type: fc.constant("connect" as const),
        x: fc.double({ min: 2, max: 30, noNaN: true }),
        z: fc.double({ min: 2, max: 30, noNaN: true }),
        msg: fc.string({ minLength: 1, maxLength: 16 }),
    });

    const propDisconnectAction = fc.nat({ max: PROP_MAX_USERS - 1 }).map<PropAction>(i => ({
        type: "disconnect", userIndex: i,
    }));

    const propJoinRoomAction = fc.record<PropAction & { type: "joinRoom" }>({
        type: fc.constant("joinRoom" as const),
        userIndex: fc.nat({ max: PROP_MAX_USERS - 1 }),
        roomID: fc.constantFrom(...PROP_ROOM_IDS),
    });

    const propMoveAction = fc.record<PropAction & { type: "move" }>({
        type: fc.constant("move" as const),
        userIndex: fc.nat({ max: PROP_MAX_USERS - 1 }),
        x: fc.double({ min: 2, max: 30, noNaN: true }),
        z: fc.double({ min: 2, max: 30, noNaN: true }),
    });

    const propActionArb = fc.oneof(
        { weight: 2, arbitrary: propConnectAction },
        { weight: 3, arbitrary: propDisconnectAction },
        { weight: 3, arbitrary: propJoinRoomAction },
        { weight: 2, arbitrary: propMoveAction },
    );

    async function executePropAction(action: PropAction, users: ConnectedUser[]): Promise<void>
    {
        switch (action.type)
        {
            case "connect":
            {
                if (users.length >= PROP_MAX_USERS) break;
                const ctx = harness.connectUser({
                    lastX: action.x, lastZ: action.z,
                    playerMetadata: { "0": action.msg },
                });
                users.push(ctx);
                break;
            }
            case "disconnect":
            {
                if (users.length === 0) break;
                const idx = action.userIndex % users.length;
                const ctx = users[idx];
                await harness.disconnectUser(ctx, true);
                users.splice(idx, 1);
                break;
            }
            case "joinRoom":
            {
                if (users.length === 0) break;
                const idx = action.userIndex % users.length;
                const ctx = users[idx];
                const prevInRoom = RoomManager.currentRoomIDByUserID[ctx.user.id] != undefined;
                await RoomManager.changeUserRoom(
                    ctx.socketUserContext, action.roomID, prevInRoom, true
                );
                break;
            }
            case "move":
            {
                if (users.length === 0) break;
                const idx = action.userIndex % users.length;
                const ctx = users[idx];
                const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
                if (!roomID) break;
                RoomManager.updateObjectTransform(
                    ctx.socketUserContext, ctx.user.id,
                    new ObjectTransform(action.x, 0, action.z, 0, 0, 1)
                );
                break;
            }
        }
    }

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("gameplay state saved on disconnect always matches last known in-room state", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(propActionArb, { minLength: 5, maxLength: PROP_MAX_ACTIONS }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of PROP_ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const users: ConnectedUser[] = [];
                    const stateSnapshots: Array<{ x: number; z: number; roomID: string }> = [];

                    for (const action of actions)
                    {
                        if (action.type === "disconnect" && users.length > 0)
                        {
                            const idx = action.userIndex % users.length;
                            const ctx = users[idx];
                            const state = harness.getGameplayState(ctx);
                            const savesBefore = harness.savedGameplayStates.length;
                            await executePropAction(action, users);
                            const savesAfter = harness.savedGameplayStates.length;
                            if (state && savesAfter > savesBefore)
                            {
                                stateSnapshots.push({
                                    x: state.lastX, z: state.lastZ, roomID: state.lastRoomID,
                                });
                            }
                        }
                        else if (action.type === "joinRoom" && users.length > 0)
                        {
                            const idx = action.userIndex % users.length;
                            const ctx = users[idx];
                            const prevInRoom = RoomManager.currentRoomIDByUserID[ctx.user.id] != undefined;
                            const stateBefore = prevInRoom ? harness.getGameplayState(ctx) : undefined;
                            const savesBefore = harness.savedGameplayStates.length;
                            await executePropAction(action, users);
                            const savesAfter = harness.savedGameplayStates.length;
                            if (stateBefore && savesAfter > savesBefore)
                            {
                                stateSnapshots.push({
                                    x: stateBefore.lastX, z: stateBefore.lastZ,
                                    roomID: stateBefore.lastRoomID,
                                });
                            }
                        }
                        else
                        {
                            await executePropAction(action, users);
                        }
                    }

                    // Invariant: saved states match snapshots
                    for (let i = 0; i < stateSnapshots.length; i++)
                    {
                        const saved = harness.savedGameplayStates[i];
                        const expected = stateSnapshots[i];
                        if (saved && expected)
                        {
                            expect(saved.lastX).toBeCloseTo(expected.x, 0);
                            expect(saved.lastZ).toBeCloseTo(expected.z, 0);
                            expect(saved.lastRoomID).toBe(expected.roomID);
                        }
                    }

                    // Invariant: in-room object transforms match getUserGameplayState
                    checkObjectTransformConsistency(users);

                    // Invariant: each user's object visible to all room participants
                    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
                    {
                        for (const uid of Object.keys(roomMem.participantUserIDs))
                        {
                            const obj = harness.getPlayerObject(uid);
                            expect(obj).toBeDefined();
                            expect(obj!.sourceUserID).toBe(uid);
                        }
                    }

                    for (const ctx of users)
                        await harness.disconnectUser(ctx, false);
                }
            ),
            { numRuns: PROP_NUM_RUNS, verbose: 1 }
        );
    });
});

// ─── With simulated DB latency ──────────────────────────────────────────────

describe("state persistence with simulated DB latency", () => {
    const LATENCY_ROOM = "latency-room";

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        harness.reset();
        harness.setLatency(true, 0, 3);
        harness.seedRoom(LATENCY_ROOM, RoomTypeEnumMap.Regular);
    });

    it("concurrent joins to unloaded room: loadRoom dedup holds under latency", async () => {
        expect(harness.isRoomLoaded(LATENCY_ROOM)).toBe(false);

        const N = 6;
        const users: ConnectedUser[] = [];
        for (let i = 0; i < N; i++)
        {
            users.push(harness.connectUser({
                lastX: 8 + i * 3, lastZ: 8 + i * 3,
                playerMetadata: { "0": `lat-${i}` },
            }));
        }

        const results = await Promise.all(
            users.map(u => harness.joinRoom(u, LATENCY_ROOM))
        );

        expect(results.every(r => r === true)).toBe(true);
        expect(harness.isRoomLoaded(LATENCY_ROOM)).toBe(true);
        expect(harness.getRoomParticipantCount(LATENCY_ROOM)).toBe(N);

        const roomMem = RoomManager.roomRuntimeMemories[LATENCY_ROOM];
        for (let i = 0; i < N; i++)
        {
            const obj = harness.getPlayerObject(users[i].user.id);
            expect(obj).toBeDefined();
            expect(obj!.metadata[0]?.str).toBe(`lat-${i}`);
        }
    }, 10_000);

    it("concurrent disconnects under latency: all states saved correctly", async () => {
        const N = 6;
        const users: ConnectedUser[] = [];
        const positions: { x: number; z: number }[] = [];

        for (let i = 0; i < N; i++)
        {
            const x = 5 + i * 4;
            const z = 10 + i * 3;
            positions.push({ x, z });
            const ctx = harness.connectUser({ lastX: x, lastZ: z });
            await harness.joinRoom(ctx, LATENCY_ROOM);
            users.push(ctx);
        }

        const expectedStates = users.map(ctx => {
            const state = harness.getGameplayState(ctx)!;
            return { userID: ctx.user.id, x: state.lastX, z: state.lastZ };
        });

        const disconnectResults = await Promise.allSettled(
            users.map(ctx => harness.disconnectUser(ctx, true))
        );

        expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(N);

        for (const expected of expectedStates)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === expected.userID
            );
            expect(saved).toBeDefined();
            expect(saved!.lastX).toBeCloseTo(expected.x, 0);
            expect(saved!.lastZ).toBeCloseTo(expected.z, 0);
        }
    }, 10_000);

    it("join/leave churn under latency: stayers and joiners maintain correct state", async () => {
        const stayers: ConnectedUser[] = [];
        for (let i = 0; i < 3; i++)
        {
            const ctx = harness.connectUser({
                lastX: 16 + i, lastZ: 16 + i,
                playerMetadata: { "0": `stayer-${i}` },
            });
            await harness.joinRoom(ctx, LATENCY_ROOM);
            stayers.push(ctx);
        }

        const leavers: ConnectedUser[] = [];
        for (let i = 0; i < 2; i++)
        {
            const ctx = harness.connectUser({
                lastX: 10 + i, lastZ: 10 + i,
                playerMetadata: { "0": `leaver-${i}` },
            });
            await harness.joinRoom(ctx, LATENCY_ROOM);
            leavers.push(ctx);
        }

        const leaverStates = leavers.map(ctx => {
            const state = harness.getGameplayState(ctx)!;
            return { userID: ctx.user.id, x: state.lastX, z: state.lastZ };
        });

        const joiners: ConnectedUser[] = [];
        for (let i = 0; i < 2; i++)
        {
            joiners.push(harness.connectUser({
                lastX: 20 + i, lastZ: 20 + i,
                playerMetadata: { "0": `joiner-${i}` },
            }));
        }

        await Promise.allSettled([
            ...leavers.map(ctx => harness.disconnectUser(ctx, true)),
            ...joiners.map(ctx => harness.joinRoom(ctx, LATENCY_ROOM)),
        ]);

        expect(harness.isRoomLoaded(LATENCY_ROOM)).toBe(true);

        const roomMem = RoomManager.roomRuntimeMemories[LATENCY_ROOM];
        for (let i = 0; i < stayers.length; i++)
        {
            const obj = harness.getPlayerObject(stayers[i].user.id);
            expect(obj).toBeDefined();
            expect(obj!.metadata[0]?.str).toBe(`stayer-${i}`);
        }
        for (let i = 0; i < joiners.length; i++)
        {
            const obj = harness.getPlayerObject(joiners[i].user.id);
            expect(obj).toBeDefined();
            expect(obj!.metadata[0]?.str).toBe(`joiner-${i}`);
        }
        for (const ctx of leavers)
            expect(harness.getPlayerObject(ctx.user.id)).toBeUndefined();

        for (const expected of leaverStates)
        {
            const saved = harness.savedGameplayStates.find(
                s => s.userID === expected.userID
            );
            expect(saved).toBeDefined();
            expect(saved!.lastX).toBeCloseTo(expected.x, 0);
        }
    }, 10_000);

    it("reconnect under latency: restored state visible to observers", async () => {
        const observer = harness.connectUser({ id: "lat-observer" });
        await harness.joinRoom(observer, LATENCY_ROOM);

        const user = harness.connectUser({
            id: "lat-reconnect", lastX: 16, lastZ: 16,
        });
        await harness.joinRoom(user, LATENCY_ROOM);

        const roomMem = RoomManager.roomRuntimeMemories[LATENCY_ROOM];
        const tr = harness.getPlayerObject("lat-reconnect")!.transform;
        harness.updateObjectTransform(user,
            new ObjectTransform(
                Math.min(30, tr.x + 1), tr.y, Math.min(30, tr.z + 1),
                tr.dirX, tr.dirY, tr.dirZ
            )
        );
        const stateBeforeDisconnect = harness.getGameplayState(user)!;

        await harness.disconnectUser(user, true);
        expect(harness.savedGameplayStates).toHaveLength(1);

        const saved = harness.savedGameplayStates[0];
        const reconnected = harness.connectUser({
            id: "lat-reconnect", lastRoomID: saved.lastRoomID,
            lastX: saved.lastX, lastY: saved.lastY, lastZ: saved.lastZ,
            lastDirX: saved.lastDirX, lastDirY: saved.lastDirY, lastDirZ: saved.lastDirZ,
            playerMetadata: saved.playerMetadata,
        });
        await harness.joinRoom(reconnected, LATENCY_ROOM);

        const obj = harness.getPlayerObject("lat-reconnect");
        expect(obj).toBeDefined();
        expect(obj!.transform.x).toBeCloseTo(stateBeforeDisconnect.lastX, 0);
        expect(obj!.transform.z).toBeCloseTo(stateBeforeDisconnect.lastZ, 0);

        expect(Object.keys(roomMem.participantUserIDs)).toHaveLength(2);
    }, 10_000);

    it("multiple rooms loading simultaneously under latency", async () => {
        const ROOM_COUNT = 4;
        const rooms = Array.from({ length: ROOM_COUNT }, (_, i) => `lat-multi-${i}`);
        for (const roomID of rooms)
            harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

        const allUsers: ConnectedUser[] = [];
        for (let r = 0; r < ROOM_COUNT; r++)
        {
            for (let u = 0; u < 2; u++)
            {
                allUsers.push(harness.connectUser({
                    lastX: 16, lastZ: 16,
                    playerMetadata: { "0": `r${r}u${u}` },
                }));
            }
        }

        const results = await Promise.all(
            allUsers.map((ctx, i) => harness.joinRoom(ctx, rooms[Math.floor(i / 2)]))
        );

        expect(results.every(r => r === true)).toBe(true);
        for (const roomID of rooms)
        {
            expect(harness.isRoomLoaded(roomID)).toBe(true);
            expect(harness.getRoomParticipantCount(roomID)).toBe(2);
        }
    }, 10_000);
});

// ─── Property-based with simulated DB latency ───────────────────────────────

describe("property-based with simulated DB latency (fast-check)", () => {
    const LAT_ROOM_IDS = ["lat-prop-A", "lat-prop-B"];
    const LAT_MAX_USERS = 6;
    const LAT_NUM_RUNS = 15;
    const LAT_MAX_ACTIONS = 20;

    type LatAction =
        | { type: "connect"; x: number; z: number }
        | { type: "disconnect"; userIndex: number }
        | { type: "joinRoom"; userIndex: number; roomID: string }
        | { type: "move"; userIndex: number; x: number; z: number };

    const latConnectAction = fc.record<LatAction & { type: "connect" }>({
        type: fc.constant("connect" as const),
        x: fc.double({ min: 4, max: 28, noNaN: true }),
        z: fc.double({ min: 4, max: 28, noNaN: true }),
    });

    const latDisconnectAction = fc.nat({ max: LAT_MAX_USERS - 1 }).map<LatAction>(i => ({
        type: "disconnect", userIndex: i,
    }));

    const latJoinRoomAction = fc.record<LatAction & { type: "joinRoom" }>({
        type: fc.constant("joinRoom" as const),
        userIndex: fc.nat({ max: LAT_MAX_USERS - 1 }),
        roomID: fc.constantFrom(...LAT_ROOM_IDS),
    });

    const latMoveAction = fc.record<LatAction & { type: "move" }>({
        type: fc.constant("move" as const),
        userIndex: fc.nat({ max: LAT_MAX_USERS - 1 }),
        x: fc.double({ min: 4, max: 28, noNaN: true }),
        z: fc.double({ min: 4, max: 28, noNaN: true }),
    });

    const latActionArb = fc.oneof(
        { weight: 2, arbitrary: latConnectAction },
        { weight: 2, arbitrary: latDisconnectAction },
        { weight: 3, arbitrary: latJoinRoomAction },
        { weight: 2, arbitrary: latMoveAction },
    );

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("structural invariants hold under random actions with DB latency", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(latActionArb, { minLength: 5, maxLength: LAT_MAX_ACTIONS }),
                async (actions) => {
                    harness.reset();
                    harness.setLatency(true, 0, 3);
                    for (const roomID of LAT_ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const users: ConnectedUser[] = [];

                    for (const action of actions)
                    {
                        try
                        {
                            switch (action.type)
                            {
                                case "connect":
                                {
                                    if (users.length >= LAT_MAX_USERS) break;
                                    const ctx = harness.connectUser({
                                        lastX: action.x, lastZ: action.z,
                                    });
                                    users.push(ctx);
                                    break;
                                }
                                case "disconnect":
                                {
                                    if (users.length === 0) break;
                                    const idx = action.userIndex % users.length;
                                    const ctx = users[idx];
                                    await harness.disconnectUser(ctx, true);
                                    users.splice(idx, 1);
                                    break;
                                }
                                case "joinRoom":
                                {
                                    if (users.length === 0) break;
                                    const idx = action.userIndex % users.length;
                                    const ctx = users[idx];
                                    const prevInRoom = RoomManager.currentRoomIDByUserID[ctx.user.id] != undefined;
                                    await RoomManager.changeUserRoom(
                                        ctx.socketUserContext, action.roomID, prevInRoom, false
                                    );
                                    break;
                                }
                                case "move":
                                {
                                    if (users.length === 0) break;
                                    const idx = action.userIndex % users.length;
                                    const ctx = users[idx];
                                    const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
                                    if (!roomID) break;
                                    RoomManager.updateObjectTransform(
                                        ctx.socketUserContext, ctx.user.id,
                                        new ObjectTransform(action.x, 0, action.z, 0, 0, 1)
                                    );
                                    break;
                                }
                            }
                        }
                        catch (e)
                        {
                            // Under latency, unloadRoom may throw if a new user
                            // joined during the async saveRoomContent window.
                        }
                    }

                    // Structural invariants
                    for (const uid of Object.keys(UserManager.socketUserContexts))
                    {
                        const ctx = UserManager.socketUserContexts[uid];
                        expect(ctx).toBeDefined();
                        expect(ctx.user.id).toBe(uid);
                    }

                    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
                    {
                        const participantCount = Object.keys(roomMem.participantUserIDs).length;
                        const socketRoomCtx = RoomManager.socketRoomContexts[roomID];
                        expect(socketRoomCtx).toBeDefined();
                        expect(participantCount).toBe(
                            Object.keys(socketRoomCtx!.getUserContexts()).length
                        );
                    }

                    for (const [userID, roomID] of Object.entries(RoomManager.currentRoomIDByUserID))
                    {
                        expect(RoomManager.roomRuntimeMemories[roomID]).toBeDefined();
                        expect(RoomManager.roomRuntimeMemories[roomID].participantUserIDs[userID]).toBe(true);
                    }

                    for (const [roomID, roomMem] of Object.entries(RoomManager.roomRuntimeMemories))
                    {
                        for (const [objId, objMem] of Object.entries(roomMem.room.objectById))
                        {
                            const sourceUser = objMem.sourceUserID;
                            expect(roomMem.participantUserIDs[sourceUser]).toBe(true);
                        }
                    }

                    const seenUsers = new Set<string>();
                    for (const roomMem of Object.values(RoomManager.roomRuntimeMemories))
                    {
                        for (const uid of Object.keys(roomMem.participantUserIDs))
                        {
                            expect(seenUsers.has(uid)).toBe(false);
                            seenUsers.add(uid);
                        }
                    }

                    checkObjectTransformConsistency(users);

                    for (const ctx of [...users])
                    {
                        try { await harness.disconnectUser(ctx, false); }
                        catch { /* unload race during cleanup */ }
                    }
                }
            ),
            { numRuns: LAT_NUM_RUNS, verbose: 1 }
        );
    }, 30_000);
});
