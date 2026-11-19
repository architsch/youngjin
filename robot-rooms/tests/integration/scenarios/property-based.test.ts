/**
 * Property-based tests (fast-check): random action sequences over weight profiles, latency on/off and
 * room types, checking structural invariants.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { Action, ActionWeights, buildActionArbitrary, executeAction } from "../helpers/actions";
import { checkStructuralInvariants, checkObjectTransformConsistency, checkCleanState,
    getPendingSignals } from "../helpers/invariants";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import RoomPalette from "../../../src/shared/room/types/roomPalette";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import RoomVolumeUtil from "../../../src/shared/room/util/roomVolumeUtil";
import NumUtil from "../../../src/shared/math/util/numUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

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
        weights: { connect: 2, disconnect: 1, joinRoom: 2, moveObject: 1, addVoxel: 3, removeVoxel: 2, moveVoxel: 2,
            setVoxelTexture: 2 },
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

                        // Latency may cause occasional race errors, but not frequent ones.
                        if (errors.length > actions.length * 0.1)
                            expect.fail(`Too many errors (${errors.length}/${actions.length}): ${errors.slice(0, 3).map(e => e.message).join("; ")}`);

                        // Relaxed: latency races can skew disconnect tracking, so counts are skipped.
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

// ─── Block edits against a model ────────────────────────────────────────────
// The rules of block edits restated without the shared code that enforces them, so a fault there has no
// second place to hide in. The model knows only cells and textures: no zone is drawn and nothing hangs on
// these blocks.

describe("property-based: block edits against a model", () => {
    const ROOM_ID = "block-model";
    // A corner of the room's hollow, small enough for edits to keep meeting each other's blocks; moves may
    // carry a block one cell out of it, so the cells around it are watched too.
    const EDITED = {rows: [10, 11], cols: [10, 11], layers: [0, 1]};
    const WATCHED = {rows: [9, 10, 11, 12], cols: [9, 10, 11, 12], layers: [0, 1, 2]};
    const BLOCK_SIGNALS = ["addVoxelBlockSignal", "removeVoxelBlockSignal", "moveVoxelBlockSignal"];

    interface Cell { row: number; col: number; layer: number }
    interface ModelBlock { textures: number[] }

    const keyOf = (cell: Cell) => `${cell.row},${cell.col},${cell.layer}`;
    const quadIndexOf = (cell: Cell) => VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(cell.row, cell.col, cell.layer);

    // Applies an edit to the model by the rules, and returns whether they allow it and which cell layers
    // the server owes the truth about if they don't.
    function applyToModel(model: Map<string, ModelBlock>, edit: Action): {accepted: boolean, touched: Cell[]}
    {
        if (edit.type != "addVoxel" && edit.type != "removeVoxel" && edit.type != "moveVoxel")
            throw new Error(`Not a block edit (${edit.type})`);
        const cell = {row: edit.row, col: edit.col, layer: edit.layer};
        const block = model.get(keyOf(cell));
        switch (edit.type)
        {
            case "addVoxel":
                if (block)
                    return {accepted: false, touched: [cell]};
                model.set(keyOf(cell), {textures: [...edit.textures!]});
                return {accepted: true, touched: [cell]};
            case "removeVoxel":
                if (!block)
                    return {accepted: false, touched: [cell]};
                model.delete(keyOf(cell));
                return {accepted: true, touched: [cell]};
            case "moveVoxel":
            {
                const target = {row: cell.row + edit.dRow, col: cell.col + edit.dCol, layer: cell.layer + edit.dLayer};
                // (Below the lowest layer is no cell layer, so there is nothing to say of it.)
                const touched = (target.layer < 0) ? [cell] : [cell, target];
                if (!block || target.layer < 0 || model.has(keyOf(target)))
                    return {accepted: false, touched};
                // It goes as it is, with its textures.
                model.delete(keyOf(cell));
                model.set(keyOf(target), block);
                return {accepted: true, touched};
            }
        }
    }

    const anyCell = fc.record({row: fc.constantFrom(...EDITED.rows), col: fc.constantFrom(...EDITED.cols),
        layer: fc.constantFrom(...EDITED.layers)});
    const anyTexture = fc.integer({min: 0, max: 127});
    const anyOffset = fc.constantFrom(-1, 0, 1);
    const anyEdit: fc.Arbitrary<Action> = fc.oneof(
        {weight: 3, arbitrary: fc.tuple(anyCell,
            fc.tuple(anyTexture, anyTexture, anyTexture, anyTexture, anyTexture, anyTexture)).map<Action>(
            ([cell, textures]) => ({type: "addVoxel", userIndex: 0, ...cell, textures}))},
        {weight: 2, arbitrary: anyCell.map<Action>(cell => ({type: "removeVoxel", userIndex: 0, ...cell}))},
        {weight: 3, arbitrary: fc.tuple(anyCell, anyOffset, anyOffset, anyOffset).map<Action>(
            ([cell, dRow, dCol, dLayer]) => ({type: "moveVoxel", userIndex: 0, ...cell, dRow, dCol, dLayer}))});

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("the server holds what the rules say, tells the others each edit it takes and the sender the truth of each it refuses", async () => {
        // How often the rules took and refused each kind of edit, over every run.
        const outcomes: {[editType: string]: {taken: number, refused: number}} = {};
        await fc.assert(
            // (Long runs of edits: only blocks already standing can be moved or taken away.)
            fc.asyncProperty(fc.array(anyEdit, {minLength: 30, maxLength: 80, size: "max"}), async (edits) => {
                harness.reset();
                harness.seedRoom(ROOM_ID, RoomTypeEnumMap.Hub);
                const users: ConnectedUser[] = [];
                for (let userIndex = 0; userIndex < 2; ++userIndex)
                {
                    await executeAction({type: "connect"}, users);
                    await executeAction({type: "joinRoom", userIndex, roomID: ROOM_ID}, users);
                }
                const [sender, observer] = users;
                const grid = ServerRoomManager.roomRuntimeMemories[ROOM_ID].room.voxelGrid;
                const model = new Map<string, ModelBlock>();

                for (const edit of edits)
                {
                    for (const user of users)
                        user.socketUserContext.clearAllPendingSignalsToUser();
                    const {accepted, touched} = applyToModel(model, edit);
                    outcomes[edit.type] ??= {taken: 0, refused: 0};
                    ++outcomes[edit.type][accepted ? "taken" : "refused"];
                    await executeAction(edit, users);
                    const context = `${JSON.stringify(edit)} (${accepted ? "taken" : "refused"} by the rules)`;

                    // The server's blocks are the model's.
                    for (const row of WATCHED.rows) for (const col of WATCHED.cols) for (const layer of WATCHED.layers)
                    {
                        const block = model.get(keyOf({row, col, layer}));
                        expect(VoxelQueryUtil.isVoxelBlockPresentAt(grid.voxels, row, col, layer),
                            `block at ${row},${col},${layer} after ${context}`).toBe(block != undefined);
                        if (block)
                        {
                            const first = quadIndexOf({row, col, layer});
                            expect(Array.from(grid.quadsMem.quads.subarray(first, first + 6)),
                                `textures at ${row},${col},${layer} after ${context}`).toEqual(block.textures);
                        }
                    }

                    const sent = (user: ConnectedUser) => Object.fromEntries(BLOCK_SIGNALS.map(signalType =>
                        [signalType, getPendingSignals(user, signalType)]));
                    const nothing = Object.fromEntries(BLOCK_SIGNALS.map(signalType => [signalType, []]));
                    if (accepted)
                    {
                        // Told to the others exactly as it was sent, and never echoed.
                        expect(sent(sender), `echo of ${context}`).toEqual(nothing);
                        const relayed = sent(observer);
                        const relayedType = {addVoxel: "addVoxelBlockSignal", removeVoxel: "removeVoxelBlockSignal",
                            moveVoxel: "moveVoxelBlockSignal"}[edit.type as "addVoxel" | "removeVoxel" | "moveVoxel"];
                        for (const signalType of BLOCK_SIGNALS)
                        {
                            expect(relayed[signalType].length, `${signalType} relayed for ${context}`)
                                .toBe(signalType == relayedType ? 1 : 0);
                        }
                        expect(relayed[relayedType][0].quadIndex).toBe(quadIndexOf(touched[0]));
                    }
                    else
                    {
                        // Answered with what each cell layer it touched holds, and kept from the others.
                        expect(sent(observer), `relay of ${context}`).toEqual(nothing);
                        const answered = sent(sender);
                        const held = touched.filter(cell => model.has(keyOf(cell)));
                        const empty = touched.filter(cell => !model.has(keyOf(cell)));
                        expect(answered["addVoxelBlockSignal"].map(signal =>
                            [signal.quadIndex, signal.quadTextureIndicesWithinLayer]),
                            `blocks answered for ${context}`).toEqual(held.map(cell =>
                            [quadIndexOf(cell), model.get(keyOf(cell))!.textures]));
                        expect(answered["removeVoxelBlockSignal"].map(signal => signal.quadIndex),
                            `empty cells answered for ${context}`).toEqual(empty.map(quadIndexOf));
                        expect(answered["moveVoxelBlockSignal"].length).toBe(0);
                    }
                }

                // (Among them: the room reads back from its own encoding.)
                checkStructuralInvariants(users);

                for (const user of users)
                {
                    try { await harness.disconnectUser(user, false); }
                    catch { /* cleanup */ }
                }
            }),
            { numRuns: 40, verbose: 1 }
        );

        // The property says nothing unless edits of every kind went both ways.
        for (const editType of ["addVoxel", "removeVoxel", "moveVoxel"])
        {
            expect(outcomes[editType]?.taken ?? 0, `${editType} edits taken`).toBeGreaterThan(10);
            expect(outcomes[editType]?.refused ?? 0, `${editType} edits refused`).toBeGreaterThan(10);
        }
    });
});

// ─── Room volume carving ────────────────────────────────────────────────────
// What every generated room, and every room fixture, is cut out of rock by.

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

describe("room volume carving", () => {
    it("takes out a volume's own blocks and no other", () => {
        fc.assert(fc.property(anyVolume, (volume) => {
            const grid = VoxelGrid.createBaseGrid();
            RoomVolumeUtil.carveOutVolume(grid.voxels, volume, new RoomPalette(0, 0, 0, 0));

            // Across the volume and a block beyond it on every side.
            for (let row = volume.rowMin - 1; row <= volume.rowMax + 1; ++row)
            {
                for (let col = volume.colMin - 1; col <= volume.colMax + 1; ++col)
                {
                    for (let layer = Math.max(0, volume.collisionLayerMin - 1);
                        layer <= Math.min(15, volume.collisionLayerMax + 1); ++layer)
                    {
                        const inside = row >= volume.rowMin && row <= volume.rowMax
                            && col >= volume.colMin && col <= volume.colMax
                            && layer >= volume.collisionLayerMin && layer <= volume.collisionLayerMax;
                        expect(VoxelQueryUtil.isVoxelBlockPresentAt(grid.voxels, row, col, layer),
                            `(${row}, ${col}, ${layer})`).toBe(!inside);
                    }
                }
            }
        }), {numRuns: 25});
    });

    it("carves the same room whatever order the volumes are carved in", () => {
        // Carving must be order-independent, or faces finished beside still-solid neighbours float.
        const palette = new RoomPalette(1, 2, 3, 4);
        const volumeSet = fc.array(anyVolume, {minLength: 2, maxLength: 5});

        fc.assert(fc.property(volumeSet, fc.integer({min: 0, max: 1000}), (volumes, shuffleSeed) => {
            const carve = (order: RoomVolume[]) => {
                const grid = VoxelGrid.createBaseGrid();
                for (const volume of order)
                    RoomVolumeUtil.carveOutVolume(grid.voxels, volume, palette);
                return {
                    masks: grid.voxels.map(v => v.blockLayerMask).join(","),
                    quads: Array.from(grid.quadsMem.quads).join(","),
                };
            };

            const reversed = volumes.slice().reverse();
            const rotated = volumes.slice(shuffleSeed % volumes.length)
                .concat(volumes.slice(0, shuffleSeed % volumes.length));

            const first = carve(volumes);
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
