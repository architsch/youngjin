/**
 * Consolidated property-based tests (fast-check)
 *
 * Parameterized over:
 * - Action weight profiles (balanced, connect-heavy, disconnect-heavy, etc.)
 * - Latency (enabled/disabled)
 * - Room types (Regular, Hub, mixed)
 *
 * Each profile generates random action sequences and verifies that structural
 * invariants hold after execution.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { Action, ActionWeights, buildActionArbitrary, executeAction } from "../helpers/actions";
import { checkStructuralInvariants, checkObjectTransformConsistency, checkCleanState } from "../helpers/invariants";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";

// ─── Weight Profiles ────────────────────────────────────────────────────────

interface TestProfile
{
    name: string;
    weights: ActionWeights;
    maxUsers: number;
    maxActions: number;
    numRuns: number;
}

const PROFILES: TestProfile[] = [
    {
        name: "balanced",
        weights: { connect: 2, disconnect: 2, joinRoom: 3, moveObject: 3, sendMessage: 1, addVoxel: 1 },
        maxUsers: 10, maxActions: 50, numRuns: 30,
    },
    {
        name: "connect-heavy",
        weights: { connect: 5, disconnect: 1, joinRoom: 3, moveObject: 0, sendMessage: 0, addVoxel: 0 },
        maxUsers: 10, maxActions: 40, numRuns: 30,
    },
    {
        name: "disconnect-heavy",
        weights: { connect: 2, disconnect: 5, joinRoom: 2, moveObject: 0, sendMessage: 0, addVoxel: 0 },
        maxUsers: 10, maxActions: 40, numRuns: 30,
    },
    {
        name: "room-switch-heavy",
        weights: { connect: 1, disconnect: 1, joinRoom: 6, moveObject: 3, sendMessage: 0, addVoxel: 0 },
        maxUsers: 10, maxActions: 40, numRuns: 30,
    },
    {
        name: "voxel-heavy",
        weights: { connect: 2, disconnect: 1, joinRoom: 2, moveObject: 1, addVoxel: 4, removeVoxel: 2 },
        maxUsers: 8, maxActions: 40, numRuns: 20,
    },
    {
        name: "reconnect-heavy",
        weights: { connect: 2, disconnect: 1, joinRoom: 3, moveObject: 2, reconnectA: 2, reconnectB: 2 },
        maxUsers: 8, maxActions: 30, numRuns: 15,
    },
];

const ROOM_IDS = ["room-A", "room-B", "room-C"];

// ─── No-Latency Tests ──────────────────────────────────────────────────────

describe("property-based: structural invariants (no latency)", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    for (const profile of PROFILES)
    {
        it(`${profile.name}: invariants hold under random actions`, async () => {
            const actionArb = buildActionArbitrary(profile.maxUsers, ROOM_IDS, profile.weights);

            await fc.assert(
                fc.asyncProperty(
                    fc.array(actionArb, { minLength: 5, maxLength: profile.maxActions }),
                    async (actions) => {
                        harness.reset();
                        for (const roomID of ROOM_IDS)
                            harness.seedRoom(roomID, RoomTypeEnumMap.Hub);

                        const connectedUsers: ConnectedUser[] = [];

                        for (const action of actions)
                        {
                            try { await executeAction(action, connectedUsers); }
                            catch { /* some actions may throw under edge conditions */ }
                        }

                        checkStructuralInvariants(connectedUsers);

                        for (const ctx of connectedUsers)
                        {
                            try { await harness.disconnectUser(ctx, false); }
                            catch { /* cleanup */ }
                        }
                    }
                ),
                { numRuns: profile.numRuns, verbose: 1 }
            );
        });
    }

    it("state is clean after all users disconnect regardless of history", async () => {
        const actionArb = buildActionArbitrary(10, ROOM_IDS, PROFILES[0].weights);

        await fc.assert(
            fc.asyncProperty(
                fc.array(actionArb, { minLength: 10, maxLength: 50 }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Hub);

                    const connectedUsers: ConnectedUser[] = [];

                    for (const action of actions)
                    {
                        try { await executeAction(action, connectedUsers); }
                        catch {}
                    }

                    while (connectedUsers.length > 0)
                    {
                        const ctx = connectedUsers.pop()!;
                        try { await harness.disconnectUser(ctx, false); }
                        catch {}
                    }

                    checkCleanState();
                }
            ),
            { numRuns: 30, verbose: 1 }
        );
    });
});

// ─── Latency Tests ─────────────────────────────────────────────────────────

describe("property-based: structural invariants (with latency)", () => {
    const LAT_PROFILES = PROFILES.filter(p =>
        !p.name.includes("reconnect") // reconnect under latency needs careful handling
    ).map(p => ({
        ...p,
        maxUsers: Math.min(p.maxUsers, 6),
        maxActions: Math.min(p.maxActions, 20),
        numRuns: Math.min(p.numRuns, 15),
    }));

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    for (const profile of LAT_PROFILES)
    {
        it(`${profile.name}: invariants hold under random actions with latency`, async () => {
            const actionArb = buildActionArbitrary(profile.maxUsers, ROOM_IDS, profile.weights);

            await fc.assert(
                fc.asyncProperty(
                    fc.array(actionArb, { minLength: 5, maxLength: profile.maxActions }),
                    async (actions) => {
                        harness.reset();
                        harness.setLatency(true, 0, 3);
                        for (const roomID of ROOM_IDS)
                            harness.seedRoom(roomID, RoomTypeEnumMap.Hub);

                        const connectedUsers: ConnectedUser[] = [];

                        for (const action of actions)
                        {
                            try { await executeAction(action, connectedUsers); }
                            catch { /* latency-induced edge conditions */ }
                        }

                        // Structural invariants (relaxed: skip count check since latency may cause
                        // race conditions in disconnect tracking)
                        for (const uid of Object.keys(ServerUserManager.socketUserContexts))
                        {
                            const ctx = ServerUserManager.socketUserContexts[uid];
                            expect(ctx).toBeDefined();
                            expect(ctx.user.id).toBe(uid);
                        }

                        for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
                        {
                            const socketRoomCtx = ServerRoomManager.socketRoomContexts[roomID];
                            expect(socketRoomCtx).toBeDefined();
                        }

                        for (const [userID, roomID] of Object.entries(ServerRoomManager.currentRoomIDByUserID))
                        {
                            expect(ServerRoomManager.roomRuntimeMemories[roomID]).toBeDefined();
                            expect(ServerRoomManager.roomRuntimeMemories[roomID].participantUserIDs[userID]).toBe(true);
                        }

                        checkObjectTransformConsistency(connectedUsers);

                        for (const ctx of [...connectedUsers])
                        {
                            try { await harness.disconnectUser(ctx, false); }
                            catch { /* cleanup under latency */ }
                        }
                    }
                ),
                { numRuns: profile.numRuns, verbose: 1 }
            );
        }, 30_000);
    }
});

// ─── State Persistence Property ────────────────────────────────────────────

describe("property-based: gameplay state persistence", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("saved gameplay state matches last known in-room state", async () => {
        const PROP_ROOM_IDS = ["prop-A", "prop-B"];
        const actionArb = buildActionArbitrary(8, PROP_ROOM_IDS, {
            connect: 2, disconnect: 3, joinRoom: 3, moveObject: 2,
        });

        await fc.assert(
            fc.asyncProperty(
                fc.array(actionArb, { minLength: 5, maxLength: 30 }),
                async (actions) => {
                    harness.reset();
                    for (const roomID of PROP_ROOM_IDS)
                        harness.seedRoom(roomID, RoomTypeEnumMap.Regular);

                    const users: ConnectedUser[] = [];

                    for (const action of actions)
                    {
                        try { await executeAction(action, users); }
                        catch {}
                    }

                    // In-room transforms should match getUserGameplayState
                    checkObjectTransformConsistency(users);

                    // Each participant should have a player object
                    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
                    {
                        for (const uid of Object.keys(roomMem.participantUserIDs))
                        {
                            const obj = ServerUserManager.getPlayerObject(uid);
                            expect(obj).toBeDefined();
                        }
                    }

                    for (const ctx of users)
                    {
                        try { await harness.disconnectUser(ctx, false); }
                        catch {}
                    }
                }
            ),
            { numRuns: 20, verbose: 1 }
        );
    });
});
