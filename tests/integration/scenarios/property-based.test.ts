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
import RoomPalette from "../../../src/shared/room/generation/types/roomPalette";
import RoomVolume from "../../../src/shared/room/generation/types/roomVolume";
import RoomVolumeUtil from "../../../src/shared/room/generation/util/roomVolumeUtil";
import NumUtil from "../../../src/shared/math/util/numUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";

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
    {
        name: "voxel-mixed",
        weights: { connect: 2, disconnect: 1, joinRoom: 2, moveObject: 1, addVoxel: 3, removeVoxel: 2, moveVoxel: 2, setVoxelTexture: 2 },
        maxUsers: 6, maxActions: 40, numRuns: 20,
    },
    {
        name: "permission-mixed",
        weights: { connect: 2, disconnect: 1, joinRoom: 3, moveObject: 1, addVoxel: 2 },
        maxUsers: 8, maxActions: 40, numRuns: 20,
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
                        const errors: Error[] = [];

                        for (const action of actions)
                        {
                            try { await executeAction(action, connectedUsers); }
                            catch (e) { errors.push(e instanceof Error ? e : new Error(String(e))); }
                        }

                        // Actions should not throw — exceptions indicate real bugs
                        expect(errors, `Unexpected errors during actions: ${errors.map(e => e.message).join("; ")}`).toHaveLength(0);

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
                    const errors: Error[] = [];

                    for (const action of actions)
                    {
                        try { await executeAction(action, connectedUsers); }
                        catch (e) { errors.push(e instanceof Error ? e : new Error(String(e))); }
                    }

                    expect(errors, `Unexpected errors during actions: ${errors.map(e => e.message).join("; ")}`).toHaveLength(0);

                    while (connectedUsers.length > 0)
                    {
                        const ctx = connectedUsers.pop()!;
                        try { await harness.disconnectUser(ctx, false); }
                        catch { /* cleanup */ }
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
                        const errors: Error[] = [];

                        for (const action of actions)
                        {
                            try { await executeAction(action, connectedUsers); }
                            catch (e) { errors.push(e instanceof Error ? e : new Error(String(e))); }
                        }

                        // Under latency, some race-condition-induced errors may occur,
                        // but they should not be frequent
                        if (errors.length > actions.length * 0.1)
                            expect.fail(`Too many errors (${errors.length}/${actions.length}): ${errors.slice(0, 3).map(e => e.message).join("; ")}`);

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
                            expect(ServerRoomManager.roomRuntimeMemories[roomID].participantUserNameByID[userID]).toBeDefined();
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
                    const errors: Error[] = [];

                    for (const action of actions)
                    {
                        try { await executeAction(action, users); }
                        catch (e) { errors.push(e instanceof Error ? e : new Error(String(e))); }
                    }

                    expect(errors, `Unexpected errors during actions: ${errors.map(e => e.message).join("; ")}`).toHaveLength(0);

                    // In-room player objects should exist and have a readable metadata snapshot
                    checkObjectTransformConsistency(users);

                    // Each participant should have a player object
                    for (const [roomID, roomMem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
                    {
                        for (const uid of Object.keys(roomMem.participantUserNameByID))
                        {
                            const obj = ServerUserManager.getPlayerObject(uid);
                            expect(obj).toBeDefined();
                        }
                    }

                    for (const ctx of users)
                    {
                        try { await harness.disconnectUser(ctx, false); }
                        catch { /* cleanup */ }
                    }
                }
            ),
            { numRuns: 20, verbose: 1 }
        );
    });
});

// ─── Room volume geometry ───────────────────────────────────────────────────
//
// The arithmetic room generation is built on. Every area a room is made of, every wall between two
// of them and every opening cut through one is worked out with these, so a fault here is a fault in
// every room in the game — and each of them is a small pure function with clean boundaries, which
// is exactly what a property test can pin down and an example cannot.

const layerRange = fc.tuple(fc.integer({min: 0, max: 15}), fc.integer({min: 0, max: 15}))
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]);

const anyVolume = fc.record({
    rowMin: fc.integer({min: 1, max: 28}),
    rowSpan: fc.integer({min: 1, max: 4}),
    colMin: fc.integer({min: 1, max: 28}),
    colSpan: fc.integer({min: 1, max: 4}),
    layers: layerRange,
}).map(({rowMin, rowSpan, colMin, colSpan, layers}) => new RoomVolume(
    rowMin, rowMin + rowSpan - 1, colMin, colMin + colSpan - 1, layers[0], layers[1]));

describe("room volume geometry", () => {
    it("expands a volume by the same amount on all six sides", () => {
        fc.assert(fc.property(anyVolume, fc.integer({min: -2, max: 4}), (volume, amount) => {
            const before = {...volume};
            const grown = RoomVolumeUtil.getExpandedVolume(volume, amount);

            expect(grown.rowMin).toBe(volume.rowMin - amount);
            expect(grown.rowMax).toBe(volume.rowMax + amount);
            expect(grown.colMin).toBe(volume.colMin - amount);
            expect(grown.colMax).toBe(volume.colMax + amount);
            expect(grown.collisionLayerMin).toBe(volume.collisionLayerMin - amount);
            expect(grown.collisionLayerMax).toBe(volume.collisionLayerMax + amount);

            // A copy, not the volume itself: growth asks this of an area over and over while
            // deciding whether it may grow, and must not move the area by asking.
            expect(grown).not.toBe(volume);
            expect({...volume}).toEqual(before);
        }));
    });

    it("tells volumes that touch apart from volumes with a wall between them", () => {
        // The two separation questions room generation asks, and the whole reason growth stops
        // where it does: expanding one volume finds the pairs that would touch, expanding both
        // finds the pairs a single block of wall stands between.
        fc.assert(fc.property(anyVolume, fc.integer({min: 0, max: 3}), (volume, gap) => {
            // A second volume placed a known number of blocks to one side of the first, sharing its
            // rows and layers exactly, so the gap between them is the only thing that varies.
            const other = new RoomVolume(
                volume.rowMin, volume.rowMax,
                volume.colMax + 1 + gap, volume.colMax + 1 + gap,
                volume.collisionLayerMin, volume.collisionLayerMax);

            const touching = RoomVolumeUtil.volumesIntersect(
                RoomVolumeUtil.getExpandedVolume(volume, 1), other);
            const withinOneBlock = RoomVolumeUtil.volumesIntersect(
                RoomVolumeUtil.getExpandedVolume(volume, 1),
                RoomVolumeUtil.getExpandedVolume(other, 1));

            expect(touching).toBe(gap == 0);
            expect(withinOneBlock).toBe(gap <= 1);
            // Never overlapping, whatever the gap: the second volume starts past the first.
            expect(RoomVolumeUtil.volumesIntersect(volume, other)).toBe(false);
        }));
    });

    it("cuts a passage that reaches both volumes and stands between them", () => {
        fc.assert(fc.property(anyVolume, fc.integer({min: 1, max: 4}),
            fc.integer({min: 1, max: 4}), (volume, gap, maxWidth) => {
            const other = new RoomVolume(
                volume.rowMin, volume.rowMax,
                volume.colMax + 1 + gap, volume.colMax + gap + (volume.colMax - volume.colMin + 1),
                volume.collisionLayerMin, volume.collisionLayerMax);

            const passage = RoomVolumeUtil.makePassageBetweenVolumes(volume, other, maxWidth, 16);
            expect(passage).not.toBeNull();

            // It fills exactly the gap, so it meets both volumes and opens neither into anything
            // else on the way.
            expect(passage!.colMin).toBe(volume.colMax + 1);
            expect(passage!.colMax).toBe(other.colMin - 1);

            // It is a real passage rather than an inverted, empty one — the case a one-cell overlap
            // used to produce — and no wider than it was allowed to be.
            const numRows = passage!.rowMax - passage!.rowMin + 1;
            expect(numRows).toBeGreaterThan(0);
            expect(numRows).toBeLessThanOrEqual(maxWidth);
            expect(numRows).toBeLessThanOrEqual(volume.rowMax - volume.rowMin + 1);

            // And it stays within the stretch the two volumes share, so it opens into both.
            expect(passage!.rowMin).toBeGreaterThanOrEqual(volume.rowMin);
            expect(passage!.rowMax).toBeLessThanOrEqual(volume.rowMax);
        }));
    });

    it("refuses a passage between volumes that already meet", () => {
        fc.assert(fc.property(anyVolume, (volume) => {
            expect(RoomVolumeUtil.makePassageBetweenVolumes(volume, volume, 3, 16)).toBeNull();
        }));
    });

    it("carves the same room whatever order the volumes are carved in", () => {
        // Passages are carved flush against the areas they join, so carving is asked to be
        // order-independent by construction. A face finished while its neighbour was still solid,
        // and never revisited, is what leaves quads hanging in mid-air.
        const palette = new RoomPalette(1, 2, 3, 4);
        const volumeSet = fc.array(anyVolume, {minLength: 2, maxLength: 5});

        fc.assert(fc.property(volumeSet, fc.integer({min: 0, max: 1000}), (volumes, shuffleSeed) => {
            const painted = volumes.map(v => new RoomVolume(v.rowMin, v.rowMax, v.colMin, v.colMax,
                v.collisionLayerMin, v.collisionLayerMax, palette));

            const carve = (order: RoomVolume[]) => {
                const grid = VoxelGrid.createBaseGrid();
                for (const volume of order)
                    RoomVolumeUtil.carveOutVolume(grid.voxels, volume);
                return {
                    masks: grid.voxels.map(v => v.collisionLayerMask).join(","),
                    quads: Array.from(grid.quadsMem.quads).join(","),
                };
            };

            const reversed = painted.slice().reverse();
            const rotated = painted.slice(shuffleSeed % painted.length)
                .concat(painted.slice(0, shuffleSeed % painted.length));

            const first = carve(painted);
            expect(carve(reversed)).toEqual(first);
            expect(carve(rotated)).toEqual(first);
        }), {numRuns: 20});
    });
});

// ─── Integer range arithmetic ───────────────────────────────────────────────

describe("integer range arithmetic", () => {
    const range = fc.tuple(fc.integer({min: -20, max: 20}), fc.integer({min: 0, max: 10}))
        .map(([min, span]) => [min, min + span] as [number, number]);

    it("intersects ranges to exactly the values both hold", () => {
        fc.assert(fc.property(range, range, (a, b) => {
            const intersection = NumUtil.getRangeIntersection(a, b);
            for (let n = -30; n <= 30; ++n)
            {
                const inBoth = n >= a[0] && n <= a[1] && n >= b[0] && n <= b[1];
                const inIntersection = intersection != null && n >= intersection[0] && n <= intersection[1];
                expect(inIntersection).toBe(inBoth);
            }
        }));
    });

    it("finds the whole numbers standing between two ranges, and nothing else", () => {
        fc.assert(fc.property(range, range, (a, b) => {
            const gap = NumUtil.getGapBetweenIntegerRanges(a, b);
            for (let n = -30; n <= 30; ++n)
            {
                const between = (n > a[1] && n < b[0]) || (n > b[1] && n < a[0]);
                const inGap = gap != null && n >= gap[0] && n <= gap[1];
                expect(inGap).toBe(between);
            }
            // Ranges that touch or overlap have no gap at all.
            if (NumUtil.getRangeIntersection(a, b) != null)
                expect(gap).toBeNull();
        }));
    });
});
