/**
 * Scenario tests: the room's surface as its blocks make it. A cell layer holds a block or none (see Voxel),
 * and everything asked of the room's surface follows from that alone.
 * Covers: what counts as a block, the rock beyond the layers and outside the grid included; where a quad lies
 * and how large it is; which face a face runs on into along the room's surface, round corners included, and
 * the way a walk carries on over it; where a block added on a face goes; the colliders physics makes of the
 * room.
 */
import { describe, it, expect } from "vitest";

import PhysicsRoom from "../../../src/shared/physics/types/physicsRoom";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Room from "../../../src/shared/room/types/room";
import Vec3 from "../../../src/shared/math/types/vec3";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, MAX_ROOM_Y,
    NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_ROWS,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";

type FacingAxis = "x" | "y" | "z";
type Orientation = "-" | "+";

const AXES: FacingAxis[] = ["x", "y", "z"];
const FACES: {axis: FacingAxis, orientation: Orientation}[] = [
    {axis: "y", orientation: "-"}, {axis: "y", orientation: "+"},
    {axis: "x", orientation: "-"}, {axis: "x", orientation: "+"},
    {axis: "z", orientation: "-"}, {axis: "z", orientation: "+"},
];

// The voxels whose quads are asked about: a corner of the grid and the middle of a side, so that the room's
// edge, its corner and its inside all come into it.
const SAMPLED_ROWS = [...range(0, 8), ...range(NUM_VOXEL_ROWS - 6, NUM_VOXEL_ROWS)];
const SAMPLED_COLS = [...range(0, 8), ...range(0.5 * NUM_VOXEL_COLS - 3, 0.5 * NUM_VOXEL_COLS + 3)];

function range(from: number, to: number): number[]
{
    return Array.from({length: to - from}, (_, i) => from + i);
}

// A room whose every cell layer holds a block or not at random, about as often as not.
function randomGrid(seed: number, solidShare: number = 0.5): VoxelGrid
{
    let state = seed >>> 0;
    const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const grid = VoxelGrid.createBaseGrid();
    for (const voxel of grid.voxels)
    {
        voxel.blockLayerMask = 0;
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            if (random() < solidShare)
                voxel.blockLayerMask |= (1 << layer);
        }
    }
    return grid;
}

// A room with nothing in it but what a test stands there.
function emptyGrid(): VoxelGrid
{
    const grid = VoxelGrid.createBaseGrid();
    for (const voxel of grid.voxels)
        voxel.blockLayerMask = 0;
    return grid;
}

function setBlock(grid: VoxelGrid, row: number, col: number, layer: number): void
{
    grid.voxels[row * NUM_VOXEL_COLS + col].blockLayerMask |= (1 << layer);
}

// The oracle: a cell layer is solid if it holds a block, lies beyond the layers or lies outside the grid.
function isSolid(grid: VoxelGrid, row: number, col: number, layer: number): boolean
{
    if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS ||
        layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
    {
        return true;
    }
    return (grid.voxels[row * NUM_VOXEL_COLS + col].blockLayerMask & (1 << layer)) != 0;
}

interface Face
{
    min: Vec3;
    max: Vec3;
    normal: Vec3;
}

// The cell layer a quad is a face of: the room's own floor and ceiling are the faces of the rock just
// beyond the layers.
function cellOfQuad(quadIndex: number): {row: number, col: number, layer: number, axis: FacingAxis, sign: number}
{
    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const sign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+") ? 1 : -1;
    let layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (layer == COLLISION_LAYER_NULL)
        layer = (sign > 0) ? COLLISION_LAYER_MIN - 1 : COLLISION_LAYER_MAX + 1;
    return {row: VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex), col: VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        layer, axis, sign};
}

// Where the oracle says a quad's face lies: the side of its cell layer's cube that it is turned to.
function oracleFace(quadIndex: number): Face
{
    const {row, col, layer, axis, sign} = cellOfQuad(quadIndex);
    const min: Vec3 = {x: col * VOXEL_CELL_SIZE, y: layer * COLLISION_LAYER_HEIGHT, z: row * VOXEL_CELL_SIZE};
    const max: Vec3 = {x: min.x + VOXEL_CELL_SIZE, y: min.y + COLLISION_LAYER_HEIGHT, z: min.z + VOXEL_CELL_SIZE};
    const plane = (sign > 0) ? max[axis] : min[axis];
    min[axis] = plane;
    max[axis] = plane;
    const normal: Vec3 = {x: 0, y: 0, z: 0};
    normal[axis] = sign;
    return {min, max, normal};
}

// A quad's rectangle in the world as the game places it (see VoxelGameObject, WorldSpaceOutlineRect): its
// middle from its voxel's, and its size along the face's right and up.
function gameFace(grid: VoxelGrid, quadIndex: number): Face
{
    const {row, col, axis} = cellOfQuad(quadIndex);
    const d = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex, true);
    const middle = {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col) + d.offsetX, y: d.offsetY,
        z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row) + d.offsetZ};

    // A wall's right runs along the other horizontal axis and its up along y; a floor or ceiling's right
    // runs along x and its up along z.
    const half = (axis == "x") ? {x: 0, y: 0.5 * d.scaleY, z: 0.5 * d.scaleX}
        : (axis == "z") ? {x: 0.5 * d.scaleX, y: 0.5 * d.scaleY, z: 0}
        : {x: 0.5 * d.scaleX, y: 0, z: 0.5 * d.scaleY};
    return {
        min: {x: middle.x - half.x, y: middle.y - half.y, z: middle.z - half.z},
        max: {x: middle.x + half.x, y: middle.y + half.y, z: middle.z + half.z},
        normal: {x: d.dirX, y: d.dirY, z: d.dirZ},
    };
}

function expectSameFace(actual: Face, expected: Face, context: string): void
{
    for (const axis of AXES)
    {
        expect(actual.min[axis], `${context}: min ${axis}`).toBeCloseTo(expected.min[axis], 9);
        expect(actual.max[axis], `${context}: max ${axis}`).toBeCloseTo(expected.max[axis], 9);
        expect(actual.normal[axis], `${context}: normal ${axis}`).toBeCloseTo(expected.normal[axis], 9);
    }
}

// Whether two faces meet along a line and nowhere else: an edge of each.
function facesMeetAlongALine(a: Face, b: Face): boolean
{
    const shared = AXES.map(axis => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]));
    return shared.every(extent => extent > -1e-9) && shared.filter(extent => extent > 1e-9).length == 1;
}

function quadsOfSampledVoxels(): number[]
{
    const quadIndices: number[] = [];
    for (const row of SAMPLED_ROWS)
    {
        for (const col of SAMPLED_COLS)
        {
            const first = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(row, col);
            for (let offset = 0; offset < NUM_VOXEL_QUADS_PER_VOXEL; ++offset)
                quadIndices.push(first + offset);
        }
    }
    return quadIndices;
}

// The four ways across a face: both ways along each of the two axes it lies in.
function stepsAcross(quadIndex: number): Vec3[]
{
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    return AXES.filter(axis => axis != facingAxis).flatMap(axis => [1, -1].map(sign => {
        const step: Vec3 = {x: 0, y: 0, z: 0};
        step[axis] = sign;
        return step;
    }));
}

describe("what counts as a block", () => {
    it("is a cell layer's own bit, with solid rock beyond the layers and outside the grid", () => {
        const grid = randomGrid(1);
        let numBlocks = 0;
        for (const row of [-1, ...SAMPLED_ROWS, NUM_VOXEL_ROWS])
        {
            for (const col of [-1, ...SAMPLED_COLS, NUM_VOXEL_COLS])
            {
                for (let layer = COLLISION_LAYER_MIN - 1; layer <= COLLISION_LAYER_MAX + 1; ++layer)
                {
                    const expected = isSolid(grid, row, col, layer);
                    expect(VoxelQueryUtil.isVoxelBlockPresentAt(grid.voxels, row, col, layer), `${row},${col},${layer}`)
                        .toBe(expected);

                    // A point anywhere inside the cell layer is in the block, or in none.
                    const point = {x: (col + 0.3) * VOXEL_CELL_SIZE, y: (layer + 0.7) * COLLISION_LAYER_HEIGHT,
                        z: (row + 0.9) * VOXEL_CELL_SIZE};
                    expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, point), `${row},${col},${layer}`).toBe(expected);
                    if (expected)
                        ++numBlocks;
                }
            }
        }
        // (Both answers were asked for often.)
        expect(numBlocks).toBeGreaterThan(1000);
    });

    it("fills its cell layer: a cube as wide as a voxel and as high as a layer", () => {
        expect(VOXEL_CELL_SIZE).toBe(COLLISION_LAYER_HEIGHT);
        const box = VoxelQueryUtil.getVoxelBlockBox(5, 9, 3);
        expect(box.center).toEqual({x: 9.5 * VOXEL_CELL_SIZE, y: 3.5 * COLLISION_LAYER_HEIGHT, z: 5.5 * VOXEL_CELL_SIZE});
        expect(box.halfSize).toEqual({x: 0.5 * VOXEL_CELL_SIZE, y: 0.5 * COLLISION_LAYER_HEIGHT, z: 0.5 * VOXEL_CELL_SIZE});
    });
});

describe("where a quad lies", () => {
    it("is the side of its block that it is turned to, as large as the block's face", () => {
        const grid = emptyGrid();
        for (const quadIndex of quadsOfSampledVoxels())
            expectSameFace(gameFace(grid, quadIndex), oracleFace(quadIndex), `quad ${quadIndex}`);
    });

    it("is the room's own floor and ceiling over its voxel, for the two quads that belong to no block", () => {
        const grid = emptyGrid();
        const floor = gameFace(grid, VoxelQueryUtil.getFloorVoxelQuadIndex(7, 3));
        const ceiling = gameFace(grid, VoxelQueryUtil.getCeilingVoxelQuadIndex(7, 3));
        expect([floor.min.y, floor.max.y, floor.normal.y]).toEqual([0, 0, 1]);
        expect([ceiling.min.y, ceiling.max.y, ceiling.normal.y]).toEqual([MAX_ROOM_Y, MAX_ROOM_Y, -1]);
        for (const tile of [floor, ceiling])
        {
            expect([tile.min.x, tile.max.x]).toEqual([3 * VOXEL_CELL_SIZE, 4 * VOXEL_CELL_SIZE]);
            expect([tile.min.z, tile.max.z]).toEqual([7 * VOXEL_CELL_SIZE, 8 * VOXEL_CELL_SIZE]);
        }
    });

    it("is out of sight for a quad that isn't drawn, unless asked regardless", () => {
        const grid = emptyGrid();
        const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(5, 5, "x", "+", 2);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex)).toBe(false);
        expect(VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex).offsetY).toBeLessThan(-1000);

        setBlock(grid, 5, 5, 2);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex)).toBe(true);
        expect(VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex))
            .toEqual(VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex, true));
    });
});

describe("the face a face runs on into along the room's surface", () => {
    // A slab of the room's floor with a step up on it, seen from above (rows down, columns across), at
    // layers 0 and 1:
    //   layer 0: columns 10..13 of row 10 solid      layer 1: column 12 of row 10 solid
    const ROW = 10;
    function steppedGrid(): VoxelGrid
    {
        const grid = emptyGrid();
        for (const col of [10, 11, 12, 13])
            setBlock(grid, ROW, col, 0);
        setBlock(grid, ROW, 12, 1);
        return grid;
    }
    const top = (col: number, layer: number) => VoxelQueryUtil.getVoxelQuadIndex(ROW, col, "y", "+", layer);
    const side = (col: number, layer: number, orientation: Orientation) =>
        VoxelQueryUtil.getVoxelQuadIndex(ROW, col, "x", orientation, layer);
    const next = (grid: VoxelGrid, quadIndex: number, step: Vec3) => VoxelQueryUtil.getVoxelQuadNextAlong(grid.voxels, quadIndex, step);

    it("is the face carrying straight on, where the surface does", () => {
        const grid = steppedGrid();
        expect(next(grid, top(10, 0), {x: 1, y: 0, z: 0})).toBe(top(11, 0));
        expect(next(grid, top(11, 0), {x: -1, y: 0, z: 0})).toBe(top(10, 0));
    });

    it("is the face of whatever stands in the way, where something does", () => {
        const grid = steppedGrid();
        // Up to the step from either side: its riser, looking back the way the walk came.
        expect(next(grid, top(11, 0), {x: 1, y: 0, z: 0})).toBe(side(12, 1, "-"));
        expect(next(grid, top(13, 0), {x: -1, y: 0, z: 0})).toBe(side(12, 1, "+"));
        // And up the riser onto nothing in the way: round the step's edge onto its top.
        expect(next(grid, side(12, 1, "-"), {x: 0, y: 1, z: 0})).toBe(top(12, 1));
    });

    it("is the next face round the edge of its own block, where the surface falls away", () => {
        const grid = steppedGrid();
        // Off the step's top onto its riser, and off the end of the slab onto its end.
        expect(next(grid, top(12, 1), {x: 1, y: 0, z: 0})).toBe(side(12, 1, "+"));
        expect(next(grid, top(13, 0), {x: 1, y: 0, z: 0})).toBe(side(13, 0, "+"));
        // Down the slab's end, the room's own floor stands in the way.
        expect(next(grid, side(13, 0, "+"), {x: 0, y: -1, z: 0})).toBe(VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, 14));
    });

    it("runs over the room's own floor and ceiling as over any other face, and stops at the room's edge", () => {
        const grid = steppedGrid();
        const floor = VoxelQueryUtil.getFloorVoxelQuadIndex;
        const ceiling = VoxelQueryUtil.getCeilingVoxelQuadIndex;
        expect(next(grid, floor(ROW, 5), {x: 1, y: 0, z: 0})).toBe(floor(ROW, 6));
        expect(next(grid, floor(ROW, 9), {x: 1, y: 0, z: 0})).toBe(side(10, 0, "-"));
        expect(next(grid, ceiling(ROW, 5), {x: 0, y: 0, z: -1})).toBe(ceiling(ROW - 1, 5));
        // Past the edge lies rock with nothing drawn on it.
        expect(next(grid, floor(ROW, NUM_VOXEL_COLS - 1), {x: 1, y: 0, z: 0})).toBe(-1);
        expect(next(grid, floor(0, 5), {x: 0, y: 0, z: -1})).toBe(-1);
        // Up a block standing under the ceiling, the ceiling itself stands in the way.
        setBlock(grid, 3, 3, COLLISION_LAYER_MAX);
        expect(next(grid, VoxelQueryUtil.getVoxelQuadIndex(3, 3, "x", "+", COLLISION_LAYER_MAX), {x: 0, y: 1, z: 0}))
            .toBe(ceiling(3, 4));
    });

    it("is none for a face that isn't drawn, or along the way the face itself is turned", () => {
        const grid = steppedGrid();
        // Buried between two blocks of the slab, and the face of a block that isn't there.
        expect(next(grid, side(10, 0, "+"), {x: 0, y: 1, z: 0})).toBe(-1);
        expect(next(grid, top(20, 0), {x: 1, y: 0, z: 0})).toBe(-1);
        expect(next(grid, top(10, 0), {x: 0, y: 1, z: 0})).toBe(-1);
        expect(next(grid, top(10, 0), {x: 0, y: -1, z: 0})).toBe(-1);
    });

    it("is always drawn, another face than the one left, and joined to it along a line", () => {
        for (const seed of [11, 12])
        {
            const grid = randomGrid(seed);
            let numSteps = 0, numTurns = 0;
            for (const quadIndex of quadsOfSampledVoxels())
            {
                if (!VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex))
                    continue;
                for (const step of stepsAcross(quadIndex))
                {
                    const nextQuadIndex = VoxelQueryUtil.getVoxelQuadNextAlong(grid.voxels, quadIndex, step);
                    if (nextQuadIndex < 0)
                        continue;
                    ++numSteps;
                    const context = `seed ${seed}, quad ${quadIndex} along ${JSON.stringify(step)}`;
                    expect(nextQuadIndex, context).not.toBe(quadIndex);
                    expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, nextQuadIndex), context).toBe(true);
                    expect(facesMeetAlongALine(oracleFace(quadIndex), oracleFace(nextQuadIndex)), context).toBe(true);
                    if (VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(nextQuadIndex) !=
                        VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex))
                    {
                        ++numTurns;
                    }
                }
            }
            // (A room this rough turns most steps round a corner, and still carries some straight on.)
            expect(numSteps).toBeGreaterThan(10000);
            expect(numTurns).toBeGreaterThan(0.2 * numSteps);
            expect(numTurns).toBeLessThan(0.95 * numSteps);
        }
    });

    it("leads back from where it led, by the way a walk carries on over it", () => {
        const grid = randomGrid(21);
        let numSteps = 0;
        for (const quadIndex of quadsOfSampledVoxels())
        {
            if (!VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex))
                continue;
            for (const step of stepsAcross(quadIndex))
            {
                const nextQuadIndex = VoxelQueryUtil.getVoxelQuadNextAlong(grid.voxels, quadIndex, step);
                if (nextQuadIndex < 0)
                    continue;
                ++numSteps;
                const context = `quad ${quadIndex} along ${JSON.stringify(step)}`;

                // The walk carries on along one of the next face's own two axes...
                const onward = VoxelQueryUtil.getVoxelQuadWalkDirectionOnto(quadIndex, step, nextQuadIndex);
                const nextFacingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(nextQuadIndex);
                expect(Math.abs(onward.x) + Math.abs(onward.y) + Math.abs(onward.z), context).toBe(1);
                expect(onward[nextFacingAxis], context).toBe(0);

                // ...and turning round there leads back onto the face it left.
                const back = {x: -onward.x || 0, y: -onward.y || 0, z: -onward.z || 0};
                expect(VoxelQueryUtil.getVoxelQuadNextAlong(grid.voxels, nextQuadIndex, back), context).toBe(quadIndex);
            }
        }
        expect(numSteps).toBeGreaterThan(10000);
    });

    it("carries a walk on as the surface turns: as it went, out from a face it met, back under an edge it rounded", () => {
        const grid = steppedGrid();
        const along: Vec3 = {x: 1, y: 0, z: 0};
        const onto = (from: number, to: number) => VoxelQueryUtil.getVoxelQuadWalkDirectionOnto(from, along, to);
        expect(onto(top(10, 0), top(11, 0))).toEqual({x: 1, y: 0, z: 0});
        expect(onto(top(11, 0), side(12, 1, "-"))).toEqual({x: 0, y: 1, z: 0});
        expect(onto(top(12, 1), side(12, 1, "+"))).toEqual({x: 0, y: -1, z: 0});
    });
});

describe("adding a block on a face", () => {
    it("puts it in the cell layer the face looks into, on whichever face", () => {
        for (const {axis, orientation} of FACES)
        {
            const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(20, 30, axis, orientation, 6);
            const targetQuadIndex = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(quadIndex);
            const step = (orientation == "+") ? 1 : -1;
            expect([VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex), VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex),
                VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(targetQuadIndex)], `${orientation}${axis}`).toEqual([
                20 + ((axis == "z") ? step : 0), 30 + ((axis == "x") ? step : 0), 6 + ((axis == "y") ? step : 0)]);
            // (It names the new block by the same face, which the selection then moves to.)
            expect([VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(targetQuadIndex),
                VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(targetQuadIndex)]).toEqual([axis, orientation]);
        }
    });

    it("puts it on the room's own floor and under its ceiling", () => {
        const onFloor = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(VoxelQueryUtil.getFloorVoxelQuadIndex(4, 5));
        expect(onFloor).toBe(VoxelQueryUtil.getVoxelQuadIndex(4, 5, "y", "+", COLLISION_LAYER_MIN));
        const underCeiling = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(VoxelQueryUtil.getCeilingVoxelQuadIndex(4, 5));
        expect(underCeiling).toBe(VoxelQueryUtil.getVoxelQuadIndex(4, 5, "y", "-", COLLISION_LAYER_MAX));
    });

    it("has nowhere to put one past the top and bottom layers or outside the grid", () => {
        const target = (row: number, col: number, axis: FacingAxis, orientation: Orientation, layer: number) =>
            VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(VoxelQueryUtil.getVoxelQuadIndex(row, col, axis, orientation, layer));
        expect(target(4, 5, "y", "+", COLLISION_LAYER_MAX)).toBe(-1);
        expect(target(4, 5, "y", "-", COLLISION_LAYER_MIN)).toBe(-1);
        expect(target(0, 5, "z", "-", 3)).toBe(-1);
        expect(target(NUM_VOXEL_ROWS - 1, 5, "z", "+", 3)).toBe(-1);
        expect(target(4, 0, "x", "-", 3)).toBe(-1);
        expect(target(4, NUM_VOXEL_COLS - 1, "x", "+", 3)).toBe(-1);
        // (Just inside each of those, there is somewhere.)
        expect(target(4, 5, "y", "+", COLLISION_LAYER_MAX - 1)).toBeGreaterThanOrEqual(0);
        expect(target(1, 5, "z", "-", 3)).toBeGreaterThanOrEqual(0);
        expect(target(4, NUM_VOXEL_COLS - 2, "x", "+", 3)).toBeGreaterThanOrEqual(0);
    });
});

describe("the colliders physics makes of a room", () => {
    it("are one box per block: solid exactly where a block is", () => {
        const grid = randomGrid(31, 0.3);
        const room = {id: "surface-physics", voxelGrid: grid} as unknown as Room;
        const physicsRoom = new PhysicsRoom(room);

        let numSolid = 0, numOpen = 0;
        for (const row of SAMPLED_ROWS)
        {
            for (const col of SAMPLED_COLS)
            {
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    // A probe well inside the cell layer, clear of its neighbours.
                    const probe = {center: VoxelQueryUtil.getVoxelBlockBox(row, col, layer).center,
                        halfSize: {x: 0.2 * VOXEL_CELL_SIZE, y: 0.2 * COLLISION_LAYER_HEIGHT, z: 0.2 * VOXEL_CELL_SIZE}};
                    const solid = isSolid(grid, row, col, layer);
                    expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom, probe), `${row},${col},${layer}`)
                        .toBe(solid);
                    solid ? ++numSolid : ++numOpen;
                }
            }
        }
        expect(numSolid).toBeGreaterThan(500);
        expect(numOpen).toBeGreaterThan(500);
    });

    it("are as many as the blocks a box reaches into", () => {
        const grid = randomGrid(32, 0.5);
        const room = {id: "surface-physics-count", voxelGrid: grid} as unknown as Room;
        const physicsRoom = new PhysicsRoom(room);

        // A box over a block of voxels in the room's middle, a hair inside their outer faces.
        const rows = range(20, 24), cols = range(30, 35), layers = range(2, NUM_COLLISION_LAYERS - 3);
        const lowCorner = VoxelQueryUtil.getVoxelBlockBox(rows[0], cols[0], layers[0]);
        const highCorner = VoxelQueryUtil.getVoxelBlockBox(rows[rows.length - 1], cols[cols.length - 1], layers[layers.length - 1]);
        const inset = 0.01;
        const min = {x: lowCorner.center.x - lowCorner.halfSize.x + inset, y: lowCorner.center.y - lowCorner.halfSize.y + inset,
            z: lowCorner.center.z - lowCorner.halfSize.z + inset};
        const max = {x: highCorner.center.x + highCorner.halfSize.x - inset, y: highCorner.center.y + highCorner.halfSize.y - inset,
            z: highCorner.center.z + highCorner.halfSize.z - inset};
        const box = {center: {x: 0.5 * (min.x + max.x), y: 0.5 * (min.y + max.y), z: 0.5 * (min.z + max.z)},
            halfSize: {x: 0.5 * (max.x - min.x), y: 0.5 * (max.y - min.y), z: 0.5 * (max.z - min.z)}};

        let numBlocks = 0;
        for (const row of rows) for (const col of cols) for (const layer of layers)
        {
            if (isSolid(grid, row, col, layer))
                ++numBlocks;
        }
        expect(PhysicsColliderStateUtil.findOverlappingColliderStates(physicsRoom, box).size).toBe(numBlocks);
        expect(numBlocks).toBeGreaterThan(50);
    });
});
