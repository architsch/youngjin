/**
 * Scenario tests: block shapes. A block fills its whole cell layer, or a half or a quarter of it (see
 * VoxelBlockShapeUtil), and whatever asks about a block has to follow its shape.
 * Covers: which bit patterns are shapes at all; a shape's box and its reach on each side of its cell; the
 * three questions asked of a block (is one there, is it whole, is this point inside it); which faces a
 * room of mixed shapes draws, and where and how large, checked against an oracle that knows nothing but
 * sub-blocks; what adding a block on each kind of face comes to (a block beside it as wide as the face, or
 * the block itself grown); a bound moved between its cell's side and mid-cell; the colliders physics makes
 * of such a room.
 */
import { describe, it, expect } from "vitest";

import PhysicsRoom from "../../../src/shared/physics/types/physicsRoom";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import RandomNumberGenerator from "../../../src/shared/math/types/randomNumberGenerator";
import Room from "../../../src/shared/room/types/room";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelBlockShapeUtil from "../../../src/shared/voxel/util/voxelBlockShapeUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, MAX_ROOM_Y,
    MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_ROOM,
    NUM_VOXEL_ROWS, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";

type FacingAxis = "x" | "y" | "z";
type Orientation = "-" | "+";

// Sub-blocks by bit: (x half, z half) = (0, 0), (1, 0), (0, 1), (1, 1).
const HALVES = [0b0101, 0b1010, 0b0011, 0b1100]; // low x, high x, low z, high z
const QUARTERS = [0b0001, 0b0010, 0b0100, 0b1000];
const SHAPES = [VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE, ...HALVES, ...QUARTERS];
const NON_SHAPES = [0b0110, 0b1001, 0b0111, 0b1011, 0b1101, 0b1110]; // two diagonals, four Ls

const FACES: {axis: FacingAxis, orientation: Orientation}[] = [
    {axis: "y", orientation: "-"}, {axis: "y", orientation: "+"},
    {axis: "x", orientation: "-"}, {axis: "x", orientation: "+"},
    {axis: "z", orientation: "-"}, {axis: "z", orientation: "+"},
];

function setShape(grid: VoxelGrid, row: number, col: number, layer: number, shape: number): void
{
    grid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, layer)] = shape;
}

// A room whose every block is one of the ten shapes at random, the whole one and none the likeliest.
function randomShapeGrid(seed: number): VoxelGrid
{
    const rand = new RandomNumberGenerator(seed);
    const grid = VoxelGrid.createBaseGrid();
    for (let i = 0; i < grid.quadsMem.blockShapes.length; ++i)
    {
        const draw = rand.randomInt(0, 4);
        grid.quadsMem.blockShapes[i] = (draw == 0) ? VOXEL_BLOCK_SHAPE_EMPTY
            : (draw == 1) ? VOXEL_BLOCK_SHAPE_WHOLE
            : SHAPES[rand.randomInt(2, SHAPES.length)];
    }
    return grid;
}

// ─── The oracle: the room as half-cell sub-blocks, each solid or open, and nothing else ───

// Sub-block coordinates count halves of a cell along x and z; outside the room is solid rock.
function subBlockIsSolid(grid: VoxelGrid, subX: number, layer: number, subZ: number): boolean
{
    if (subX < 0 || subX >= 2 * NUM_VOXEL_COLS || subZ < 0 || subZ >= 2 * NUM_VOXEL_ROWS ||
        layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
    {
        return true;
    }
    const shape = grid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(subZ >> 1, subX >> 1, layer)];
    return (shape & (1 << ((subX & 1) + 2 * (subZ & 1)))) != 0;
}

// The sub-blocks of one cell layer that are solid, as [subX, subZ]; all four of the rock beyond the layers.
function solidSubBlocks(grid: VoxelGrid, row: number, col: number, layer: number): [number, number][]
{
    const found: [number, number][] = [];
    for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]])
    {
        if (subBlockIsSolid(grid, 2 * col + x, layer, 2 * row + z))
            found.push([2 * col + x, 2 * row + z]);
    }
    return found;
}

interface OracleFace
{
    // Where the face's rectangle lies in the world.
    min: {x: number, y: number, z: number};
    max: {x: number, y: number, z: number};
}

// The face a cell layer's block turns one way, or undefined if it has none to show: the outermost slice of
// its sub-blocks that way, drawn if any one of them looks at an open sub-block.
function oracleFace(grid: VoxelGrid, row: number, col: number, layer: number,
    axis: FacingAxis, orientation: Orientation): OracleFace | undefined
{
    const step = (orientation == "+") ? 1 : -1;
    let slice = solidSubBlocks(grid, row, col, layer);
    if (slice.length == 0)
        return undefined;

    if (axis != "y")
    {
        const along = (axis == "x") ? 0 : 1;
        const outermost = (step > 0) ? Math.max(...slice.map(s => s[along])) : Math.min(...slice.map(s => s[along]));
        slice = slice.filter(s => s[along] == outermost);
    }
    const looksAtOpen = slice.some(([subX, subZ]) => !subBlockIsSolid(grid,
        subX + ((axis == "x") ? step : 0), layer + ((axis == "y") ? step : 0), subZ + ((axis == "z") ? step : 0)));
    if (!looksAtOpen)
        return undefined;

    const minX = 0.5 * Math.min(...slice.map(s => s[0])), maxX = 0.5 * (Math.max(...slice.map(s => s[0])) + 1);
    const minZ = 0.5 * Math.min(...slice.map(s => s[1])), maxZ = 0.5 * (Math.max(...slice.map(s => s[1])) + 1);
    const minY = layer * COLLISION_LAYER_HEIGHT, maxY = (layer + 1) * COLLISION_LAYER_HEIGHT;
    const face: OracleFace = {min: {x: minX, y: minY, z: minZ}, max: {x: maxX, y: maxY, z: maxZ}};
    // Flat on the side it faces.
    const plane = (step > 0) ? face.max[axis] : face.min[axis];
    face.min[axis] = plane;
    face.max[axis] = plane;
    return face;
}

// The same for a quad, wherever it is: a block's face, or the room's own floor or ceiling over a cell (the
// face of the rock just beyond the layers).
function oracleFaceOfQuad(grid: VoxelGrid, quadIndex: number): OracleFace | undefined
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    let layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (layer == COLLISION_LAYER_NULL)
        layer = (orientation == "+") ? COLLISION_LAYER_MIN - 1 : COLLISION_LAYER_MAX + 1;
    return oracleFace(grid, row, col, layer, axis, orientation);
}

// A quad's rectangle in the world as the game places it (see VoxelGameObject, WorldSpaceOutlineRect): its
// middle, and its size along the face's right and up.
function gameFaceOfQuad(grid: VoxelGrid, quadIndex: number): OracleFace
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const axis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const d = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex, true);
    const middle = {x: col + 0.5 + d.offsetX, y: d.offsetY, z: row + 0.5 + d.offsetZ};

    // A wall's right runs along the other horizontal axis and its up along y; a floor or ceiling's right
    // runs along x and its up along z.
    const half = (axis == "x") ? {x: 0, y: 0.5 * d.scaleY, z: 0.5 * d.scaleX}
        : (axis == "z") ? {x: 0.5 * d.scaleX, y: 0.5 * d.scaleY, z: 0}
        : {x: 0.5 * d.scaleX, y: 0, z: 0.5 * d.scaleY};
    return {
        min: {x: middle.x - half.x, y: middle.y - half.y, z: middle.z - half.z},
        max: {x: middle.x + half.x, y: middle.y + half.y, z: middle.z + half.z},
    };
}

describe("a block's shape", () => {
    it("is one of ten: none, the whole cell layer, a half of it or a quarter", () => {
        expect(SHAPES.length).toBe(10);
        expect(new Set(SHAPES).size).toBe(10);
        for (const shape of SHAPES)
            expect(VoxelBlockShapeUtil.isValid(shape), `${shape.toString(2)}`).toBe(true);
    });

    it("is never a diagonal or an L, nor anything that is not four bits", () => {
        for (const shape of [...NON_SHAPES, -1, 16, 255, 1.5, NaN])
            expect(VoxelBlockShapeUtil.isValid(shape), `${shape}`).toBe(false);
        expect([...SHAPES, ...NON_SHAPES].sort((a, b) => a - b)).toEqual(Array.from({length: 16}, (_, i) => i));
    });

    it("gives the block a box as large as the sub-blocks it fills, wherever in the cell they are", () => {
        expect(VoxelBlockShapeUtil.getBounds(VOXEL_BLOCK_SHAPE_WHOLE)).toEqual({minX: 0, maxX: 1, minZ: 0, maxZ: 1});
        expect(VoxelBlockShapeUtil.getBounds(HALVES[0])).toEqual({minX: 0, maxX: 0.5, minZ: 0, maxZ: 1});
        expect(VoxelBlockShapeUtil.getBounds(HALVES[1])).toEqual({minX: 0.5, maxX: 1, minZ: 0, maxZ: 1});
        expect(VoxelBlockShapeUtil.getBounds(HALVES[2])).toEqual({minX: 0, maxX: 1, minZ: 0, maxZ: 0.5});
        expect(VoxelBlockShapeUtil.getBounds(HALVES[3])).toEqual({minX: 0, maxX: 1, minZ: 0.5, maxZ: 1});
        expect(VoxelBlockShapeUtil.getBounds(QUARTERS[0])).toEqual({minX: 0, maxX: 0.5, minZ: 0, maxZ: 0.5});
        expect(VoxelBlockShapeUtil.getBounds(QUARTERS[3])).toEqual({minX: 0.5, maxX: 1, minZ: 0.5, maxZ: 1});

        // The box and the bits say the same thing about every point of the cell.
        for (const shape of SHAPES.filter(s => s != VOXEL_BLOCK_SHAPE_EMPTY))
        {
            const bounds = VoxelBlockShapeUtil.getBounds(shape);
            for (const x of [0.1, 0.4, 0.6, 0.9])
            {
                for (const z of [0.1, 0.4, 0.6, 0.9])
                {
                    const inBox = x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ;
                    expect(VoxelBlockShapeUtil.containsPoint(shape, x, z), `${shape.toString(2)} at ${x},${z}`).toBe(inBox);
                }
            }
        }
    });

    it("reaches each side of its cell over the halves of that side it touches, or not at all", () => {
        const lowX = HALVES[0];
        expect(VoxelBlockShapeUtil.getSideMask(lowX, "x", "-")).toBe(0b11); // all of the side it lies against
        expect(VoxelBlockShapeUtil.getSideMask(lowX, "x", "+")).toBe(0); // short of the other
        expect(VoxelBlockShapeUtil.getSideMask(lowX, "z", "-")).toBe(0b01); // the lower-x half of each end
        expect(VoxelBlockShapeUtil.getSideMask(lowX, "z", "+")).toBe(0b01);
        expect(VoxelBlockShapeUtil.getSideMask(lowX, "y", "+")).toBe(lowX); // its own footprint above and below

        const highXHighZ = QUARTERS[3];
        expect(VoxelBlockShapeUtil.getSideMask(highXHighZ, "x", "+")).toBe(0b10);
        expect(VoxelBlockShapeUtil.getSideMask(highXHighZ, "z", "+")).toBe(0b10);
        expect(VoxelBlockShapeUtil.getSideMask(highXHighZ, "x", "-")).toBe(0);
        expect(VoxelBlockShapeUtil.getSideMask(highXHighZ, "z", "-")).toBe(0);

        for (const {axis, orientation} of FACES)
        {
            expect(VoxelBlockShapeUtil.getSideMask(VOXEL_BLOCK_SHAPE_EMPTY, axis, orientation)).toBe(0);
            expect(VoxelBlockShapeUtil.getSideMask(VOXEL_BLOCK_SHAPE_WHOLE, axis, orientation))
                .toBe((axis == "y") ? 0b1111 : 0b11);
        }
    });
});

describe("the three questions asked of a block", () => {
    const ROW = 10, COL = 12, LAYER = 4;

    it("are answered by its shape: whether one is there, whether it is whole, whether a point is inside it", () => {
        const grid = VoxelGrid.createBaseGrid();
        const voxel = VoxelQueryUtil.getVoxel(grid.voxels, ROW, COL)!;
        const pointAt = (x: number, z: number) => ({x: COL + x, y: (LAYER + 0.5) * COLLISION_LAYER_HEIGHT, z: ROW + z});

        expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, LAYER)).toBe(true);
        expect(VoxelQueryUtil.isVoxelBlockWhole(voxel, LAYER)).toBe(true);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, pointAt(0.75, 0.25))).toBe(true);

        setShape(grid, ROW, COL, LAYER, HALVES[0]); // the lower-x half
        expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, LAYER)).toBe(true);
        expect(VoxelQueryUtil.isVoxelBlockWhole(voxel, LAYER)).toBe(false);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, pointAt(0.25, 0.75))).toBe(true);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, pointAt(0.75, 0.75))).toBe(false);

        setShape(grid, ROW, COL, LAYER, VOXEL_BLOCK_SHAPE_EMPTY);
        expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, LAYER)).toBe(false);
        expect(VoxelQueryUtil.isVoxelBlockWhole(voxel, LAYER)).toBe(false);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, pointAt(0.25, 0.25))).toBe(false);
    });

    it("find solid rock beyond the layers and outside the grid", () => {
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        const voxel = VoxelQueryUtil.getVoxel(grid.voxels, ROW, COL)!;

        for (const layer of [COLLISION_LAYER_MIN - 1, COLLISION_LAYER_MAX + 1])
        {
            expect(VoxelQueryUtil.isVoxelBlockPresent(voxel, layer)).toBe(true);
            expect(VoxelQueryUtil.isVoxelBlockWhole(voxel, layer)).toBe(true);
        }
        expect(VoxelQueryUtil.isVoxelBlockWholeAt(grid.voxels, -1, COL, LAYER)).toBe(true);
        expect(VoxelQueryUtil.isVoxelBlockWholeAt(grid.voxels, ROW, NUM_VOXEL_COLS, LAYER)).toBe(true);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, {x: -0.25, y: 1, z: ROW + 0.5})).toBe(true);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, {x: COL + 0.5, y: MAX_ROOM_Y + 0.1, z: ROW + 0.5})).toBe(true);
        expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, {x: COL + 0.5, y: 1, z: ROW + 0.5})).toBe(false);
    });

    it("name the layers of a cell that hold a block, whatever their shapes", () => {
        const grid = VoxelGrid.createBaseGrid();
        const voxel = VoxelQueryUtil.getVoxel(grid.voxels, ROW, COL)!;
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            setShape(grid, ROW, COL, layer, VOXEL_BLOCK_SHAPE_EMPTY);
        setShape(grid, ROW, COL, 0, VOXEL_BLOCK_SHAPE_WHOLE);
        setShape(grid, ROW, COL, 3, HALVES[2]);
        setShape(grid, ROW, COL, 15, QUARTERS[1]);
        expect(VoxelQueryUtil.getVoxelBlockLayerMask(voxel)).toBe((1 << 0) | (1 << 3) | (1 << 15));
    });
});

describe("the faces a room of mixed shapes draws", () => {
    it("are a shrunk block's own six, the inner ones among them, with the floor showing beside it", () => {
        const ROW = 10, COL = 12;
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        setShape(grid, ROW, COL, COLLISION_LAYER_MIN, HALVES[0]); // the lower-x half, standing on the floor

        const quad = (axis: FacingAxis, orientation: Orientation) =>
            VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, axis, orientation, COLLISION_LAYER_MIN);
        for (const {axis, orientation} of FACES)
        {
            // Every face but the one it stands on.
            expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quad(axis, orientation)), `${orientation}${axis}`)
                .toBe(!(axis == "y" && orientation == "-"));
        }
        // The floor tile it only half covers stays drawn.
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL))).toBe(true);

        // The face in the middle of the cell: half a cell in from the cell's side, and still a cell long.
        const inner = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quad("x", "+"));
        expect(inner.offsetX).toBe(0); // the cell's middle
        expect(inner.offsetZ).toBe(0);
        expect(inner.scaleX).toBe(1);
        expect(inner.scaleY).toBe(COLLISION_LAYER_HEIGHT);

        // An end of it: half as wide, over the half the block fills.
        const end = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quad("z", "+"));
        expect(end.offsetX).toBe(-0.25);
        expect(end.offsetZ).toBe(0.5);
        expect(end.scaleX).toBe(0.5);

        // Its top: half a cell by a whole one.
        const top = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quad("y", "+"));
        expect(top.offsetX).toBe(-0.25);
        expect(top.offsetZ).toBe(0);
        expect(top.scaleX).toBe(0.5);
        expect(top.scaleY).toBe(1);
    });

    it("leave out a face only where the block it looks at covers all of it", () => {
        const ROW = 10, COL = 12, LAYER = 5;
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        const facingHighX = VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "x", "+", LAYER);
        const facingBack = VoxelQueryUtil.getVoxelQuadIndex(ROW, COL + 1, "x", "-", LAYER);

        // A whole block beside a quarter: the quarter's face is covered, the whole block's only partly.
        setShape(grid, ROW, COL, LAYER, VOXEL_BLOCK_SHAPE_WHOLE);
        setShape(grid, ROW, COL + 1, LAYER, QUARTERS[0]); // lower x, lower z: against the whole block
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingHighX)).toBe(true);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingBack)).toBe(false);

        // The half lying against it covers it, and is covered.
        setShape(grid, ROW, COL + 1, LAYER, HALVES[0]);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingHighX)).toBe(false);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingBack)).toBe(false);

        // The half standing off from it covers nothing: both show, the half's inner face too.
        setShape(grid, ROW, COL + 1, LAYER, HALVES[1]);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingHighX)).toBe(true);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, facingBack)).toBe(true);

        // Stacked: a quarter under a half that covers it shows no top, and the half shows its underside.
        setShape(grid, ROW, COL, LAYER, QUARTERS[0]);
        setShape(grid, ROW, COL, LAYER + 1, HALVES[0]);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels,
            VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "y", "+", LAYER))).toBe(false);
        expect(VoxelQueryUtil.isVoxelQuadVisible(grid.voxels,
            VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "y", "-", LAYER + 1))).toBe(true);
    });

    it.each([11, 2026, 90210])("match the sub-block oracle, quad for quad, in a room of random shapes (seed %i)", (seed) => {
        const grid = randomShapeGrid(seed);
        const wrongAbout: number[] = [];
        const misplaced: number[] = [];
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            const expected = oracleFaceOfQuad(grid, quadIndex);
            if (VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex) != (expected != undefined))
                wrongAbout.push(quadIndex);
            else if (expected != undefined)
            {
                const actual = gameFaceOfQuad(grid, quadIndex);
                const same = (["x", "y", "z"] as const).every(axis =>
                    actual.min[axis] == expected.min[axis] && actual.max[axis] == expected.max[axis]);
                if (!same)
                    misplaced.push(quadIndex);
            }
        }
        expect(wrongAbout.slice(0, 5), "drawn or not").toEqual([]);
        expect(misplaced.slice(0, 5), "where and how large").toEqual([]);
    });

    it("never outnumber the instances the voxel mesh has, though shrunk blocks show far more than whole ones can", () => {
        // Quarters in opposite corners of their cells from one layer to the next cover nothing of each other.
        const grid = VoxelGrid.createBaseGrid();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                    setShape(grid, row, col, layer, (layer % 2 == 0) ? QUARTERS[0] : QUARTERS[3]);
            }
        }
        let numDrawn = 0;
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            const drawn = VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex);
            expect(drawn).toBe(oracleFaceOfQuad(grid, quadIndex) != undefined);
            if (drawn)
                ++numDrawn;
        }
        // More than a room of whole blocks can show at its most (a face for every place two cells meet).
        const mostOfWholeBlocks = (NUM_COLLISION_LAYERS + 1) * NUM_VOXEL_ROWS * NUM_VOXEL_COLS +
            (NUM_VOXEL_COLS - 1) * NUM_VOXEL_ROWS * NUM_COLLISION_LAYERS +
            (NUM_VOXEL_ROWS - 1) * NUM_VOXEL_COLS * NUM_COLLISION_LAYERS;
        expect(numDrawn).toBeGreaterThan(1.9 * mostOfWholeBlocks);
        expect(numDrawn).toBeLessThanOrEqual(MAX_VISIBLE_VOXEL_QUADS_PER_ROOM);
    });

    it("are found agreeing by the rule itself and by the shapes' side reaches, for every pair of shapes", () => {
        // A face stopping short of its cell's side always shows; one on the side shows unless covered.
        for (const shape of SHAPES)
        {
            for (const facedShape of SHAPES)
            {
                for (const {axis, orientation} of FACES)
                {
                    const side = VoxelBlockShapeUtil.getSideMask(shape, axis, orientation);
                    const facedSide = VoxelBlockShapeUtil.getSideMask(facedShape, axis, (orientation == "+") ? "-" : "+");
                    const expected = shape != VOXEL_BLOCK_SHAPE_EMPTY && (side == 0 || (side & ~facedSide) != 0);
                    expect(VoxelBlockShapeUtil.showsFace(shape, facedShape, axis, orientation),
                        `${shape.toString(2)} looking ${orientation}${axis} at ${facedShape.toString(2)}`).toBe(expected);
                }
            }
        }
    });
});

describe("adding a block on a face", () => {
    const ROW = 10, COL = 10, LAYER = 5;
    const [LOW_X_HALF, , LOW_Z_HALF] = HALVES;
    const LOW_QUARTER = QUARTERS[0];

    // One block of the given shape in the open, and what adding on each of its faces comes to: the cell
    // layer the edit is made in relative to the block's own, the shape left there, and whether the block
    // itself grew.
    function targetsAround(shape: number): {[face: string]: [number, number, number, number, boolean] | undefined}
    {
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        setShape(grid, ROW, COL, LAYER, shape);

        const targets: ReturnType<typeof targetsAround> = {};
        for (const {axis, orientation} of FACES)
        {
            const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, axis, orientation, LAYER);
            const target = VoxelQueryUtil.getVoxelBlockAddTarget(grid.voxels, quadIndex);
            if (target)
            {
                // The edit is made through a quad facing the same way, so the selection can go on to it.
                expect(VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(target.quadIndex)).toBe(axis);
                expect(VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(target.quadIndex)).toBe(orientation);
            }
            targets[`${orientation}${axis}`] = target && [
                VoxelQueryUtil.getVoxelRowFromQuadIndex(target.quadIndex) - ROW,
                VoxelQueryUtil.getVoxelColFromQuadIndex(target.quadIndex) - COL,
                VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(target.quadIndex) - LAYER,
                target.shape, target.grows];
        }
        return targets;
    }

    it("puts a whole block beside a whole one, on whichever face", () => {
        expect(targetsAround(VOXEL_BLOCK_SHAPE_WHOLE)).toEqual({
            "-y": [0, 0, -1, VOXEL_BLOCK_SHAPE_WHOLE, false], "+y": [0, 0, 1, VOXEL_BLOCK_SHAPE_WHOLE, false],
            "-x": [0, -1, 0, VOXEL_BLOCK_SHAPE_WHOLE, false], "+x": [0, 1, 0, VOXEL_BLOCK_SHAPE_WHOLE, false],
            "-z": [-1, 0, 0, VOXEL_BLOCK_SHAPE_WHOLE, false], "+z": [1, 0, 0, VOXEL_BLOCK_SHAPE_WHOLE, false],
        });
    });

    it("carries a thin wall on from its ends and its top, and thickens it from its broad faces", () => {
        // The low-z half: a wall running along x, half a cell thick.
        expect(targetsAround(LOW_Z_HALF)).toEqual({
            // Over and under it, and past either end: more of the same wall.
            "-y": [0, 0, -1, LOW_Z_HALF, false], "+y": [0, 0, 1, LOW_Z_HALF, false],
            "-x": [0, -1, 0, LOW_Z_HALF, false], "+x": [0, 1, 0, LOW_Z_HALF, false],
            // On the broad face at the cell's side: a block as wide as that face and as deep as the cell beyond.
            "-z": [-1, 0, 0, VOXEL_BLOCK_SHAPE_WHOLE, false],
            // On the broad face in mid-cell there is no cell layer to put one in, so the wall itself grows.
            "+z": [0, 0, 0, VOXEL_BLOCK_SHAPE_WHOLE, true],
        });
    });

    it("grows a quarter block along whichever way its inner face looks, and extends it past its outer ones", () => {
        expect(targetsAround(LOW_QUARTER)).toEqual({
            "-y": [0, 0, -1, LOW_QUARTER, false], "+y": [0, 0, 1, LOW_QUARTER, false],
            "-x": [0, -1, 0, LOW_Z_HALF, false], "+x": [0, 0, 0, LOW_Z_HALF, true],
            "-z": [-1, 0, 0, LOW_X_HALF, false], "+z": [0, 0, 0, LOW_X_HALF, true],
        });
    });

    it("sets a block as wide as the face against every face at its cell's side, and grows the block from every other", () => {
        for (const shape of SHAPES.filter(candidate => candidate != VOXEL_BLOCK_SHAPE_EMPTY))
        {
            const targets = targetsAround(shape);
            for (const {axis, orientation} of FACES)
            {
                const [dRow, dCol, dLayer, targetShape, grows] = targets[`${orientation}${axis}`]!;
                const context = `shape ${shape}, face ${orientation}${axis}`;
                expect(VoxelBlockShapeUtil.isValid(targetShape) && targetShape != VOXEL_BLOCK_SHAPE_EMPTY, context).toBe(true);

                const ownSide = VoxelBlockShapeUtil.getSideMask(shape, axis, orientation);
                expect(grows, context).toBe(ownSide == 0);
                if (grows)
                {
                    // Where it stood, reaching the side it stopped short of, and no wider than it was.
                    expect([dRow, dCol, dLayer], context).toEqual([0, 0, 0]);
                    expect(targetShape & shape, context).toBe(shape);
                    expect(VoxelBlockShapeUtil.getSideMask(targetShape, axis, orientation), context).not.toBe(0);
                    continue;
                }
                // One cell on in the face's direction, lying against exactly the face.
                const step = (orientation == "+") ? 1 : -1;
                expect([dRow, dCol, dLayer], context).toEqual([axis == "z" ? step : 0, axis == "x" ? step : 0, axis == "y" ? step : 0]);
                expect(VoxelBlockShapeUtil.getSideMask(targetShape, axis, (orientation == "+") ? "-" : "+"), context).toBe(ownSide);
                // The new block covers the face it was set against, and that face covers its own.
                expect(VoxelBlockShapeUtil.showsFace(shape, targetShape, axis, orientation), context).toBe(false);
            }
        }
    });

    it("puts a whole block on the room's own floor and under its ceiling", () => {
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(VoxelQueryUtil.getVoxelBlockAddTarget(grid.voxels, VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL))).toEqual({
            quadIndex: VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "y", "+", COLLISION_LAYER_MIN),
            shape: VOXEL_BLOCK_SHAPE_WHOLE, grows: false});
        expect(VoxelQueryUtil.getVoxelBlockAddTarget(grid.voxels, VoxelQueryUtil.getCeilingVoxelQuadIndex(ROW, COL))).toEqual({
            quadIndex: VoxelQueryUtil.getVoxelQuadIndex(ROW, COL, "y", "-", COLLISION_LAYER_MAX),
            shape: VOXEL_BLOCK_SHAPE_WHOLE, grows: false});
    });

    it("has nowhere to put one past the top and bottom layers or outside the grid", () => {
        const grid = VoxelGrid.createBaseGrid();
        const targetOf = (row: number, col: number, axis: FacingAxis, orientation: Orientation, layer: number) =>
            VoxelQueryUtil.getVoxelBlockAddTarget(grid.voxels, VoxelQueryUtil.getVoxelQuadIndex(row, col, axis, orientation, layer));
        expect(targetOf(ROW, COL, "y", "+", COLLISION_LAYER_MAX)).toBeUndefined();
        expect(targetOf(ROW, COL, "y", "-", COLLISION_LAYER_MIN)).toBeUndefined();
        expect(targetOf(ROW, 0, "x", "-", LAYER)).toBeUndefined();
        expect(targetOf(ROW, NUM_VOXEL_COLS - 1, "x", "+", LAYER)).toBeUndefined();
        expect(targetOf(0, COL, "z", "-", LAYER)).toBeUndefined();
        expect(targetOf(NUM_VOXEL_ROWS - 1, COL, "z", "+", LAYER)).toBeUndefined();
        // (A shrunk block at the edge still grows towards the room.)
        setShape(grid, ROW, 0, LAYER, HALVES[0]);
        expect(targetOf(ROW, 0, "x", "+", LAYER)).toMatchObject({shape: VOXEL_BLOCK_SHAPE_WHOLE, grows: true});
    });

    it("stretches a shape over both halves of its cell one way, leaving it as wide the other", () => {
        for (const shape of SHAPES)
        {
            const bounds = VoxelBlockShapeUtil.getBounds(shape);
            const alongX = VoxelBlockShapeUtil.stretchAlong(shape, "x");
            const alongZ = VoxelBlockShapeUtil.stretchAlong(shape, "z");
            expect(VoxelBlockShapeUtil.stretchAlong(shape, "y"), `${shape} along y`).toBe(shape);
            if (shape == VOXEL_BLOCK_SHAPE_EMPTY)
            {
                expect([alongX, alongZ]).toEqual([VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_EMPTY]);
                continue;
            }
            expect(VoxelBlockShapeUtil.getBounds(alongX), `${shape} along x`)
                .toEqual({minX: 0, maxX: 1, minZ: bounds.minZ, maxZ: bounds.maxZ});
            expect(VoxelBlockShapeUtil.getBounds(alongZ), `${shape} along z`)
                .toEqual({minX: bounds.minX, maxX: bounds.maxX, minZ: 0, maxZ: 1});
            expect(VoxelBlockShapeUtil.stretchAlong(alongX, "x")).toBe(alongX);
        }
    });
});

describe("resizing and placing a block of a given shape", () => {
    const BOUNDS: {axis: "x" | "z", orientation: Orientation}[] = [
        {axis: "x", orientation: "-"}, {axis: "x", orientation: "+"},
        {axis: "z", orientation: "-"}, {axis: "z", orientation: "+"},
    ];
    // Where a shape's bound lies across its cell, read off its box.
    const boundPlace = (shape: number, axis: "x" | "z", orientation: Orientation) => {
        const bounds = VoxelBlockShapeUtil.getBounds(shape);
        return (axis == "x") ? ((orientation == "+") ? bounds.maxX : bounds.minX)
            : ((orientation == "+") ? bounds.maxZ : bounds.minZ);
    };

    it("knows which of a block's bounds lie in mid-cell, and what it has in each half of its cell", () => {
        for (const shape of SHAPES.filter(candidate => candidate != VOXEL_BLOCK_SHAPE_EMPTY))
        {
            for (const {axis, orientation} of BOUNDS)
            {
                const context = `shape ${shape}, ${orientation}${axis}`;
                expect(VoxelBlockShapeUtil.isBoundInMidCell(shape, axis, orientation), context)
                    .toBe(boundPlace(shape, axis, orientation) == 0.5);

                // What it has in that half is a block of its own, as wide the other way, or nothing.
                const half = VoxelBlockShapeUtil.getHalf(shape, axis, orientation);
                expect(VoxelBlockShapeUtil.isValid(half), context).toBe(true);
                expect(half & ~shape, context).toBe(0);
                expect(half == VOXEL_BLOCK_SHAPE_EMPTY, context).toBe(boundPlace(shape, axis, orientation) == 0.5);
            }
        }
    });

    it("moves one bound between its cell's side and mid-cell, leaving the bound across from it where it is", () => {
        for (const shape of SHAPES.filter(candidate => candidate != VOXEL_BLOCK_SHAPE_EMPTY))
        {
            for (const {axis, orientation} of BOUNDS)
            {
                const across = (orientation == "+") ? "-" : "+";
                for (const toMidCell of [true, false])
                {
                    const context = `shape ${shape}, ${orientation}${axis} ${toMidCell ? "to mid-cell" : "to the side"}`;
                    const moved = VoxelBlockShapeUtil.moveBound(shape, axis, orientation, toMidCell);
                    expect(VoxelBlockShapeUtil.isValid(moved), context).toBe(true);

                    // Nothing is left of a block half as wide whose bound at the side comes in.
                    const leavesNothing = toMidCell && boundPlace(shape, axis, across) == 0.5;
                    expect(moved == VOXEL_BLOCK_SHAPE_EMPTY, context).toBe(leavesNothing);
                    if (leavesNothing)
                        continue;

                    expect(boundPlace(moved, axis, orientation), context).toBe(toMidCell ? 0.5 : ((orientation == "+") ? 1 : 0));
                    expect(boundPlace(moved, axis, across), context).toBe(boundPlace(shape, axis, across));
                    // The other way across, it is as it was.
                    const otherAxis = (axis == "x") ? "z" : "x";
                    expect([boundPlace(moved, otherAxis, "-"), boundPlace(moved, otherAxis, "+")], context)
                        .toEqual([boundPlace(shape, otherAxis, "-"), boundPlace(shape, otherAxis, "+")]);
                }
            }
        }
    });

});

describe("the colliders physics makes of a room of mixed shapes", () => {
    it("are one box per block, as large as the block: solid exactly where the sub-blocks are", () => {
        const grid = randomShapeGrid(4711);
        const physicsRoom = new PhysicsRoom({voxelGrid: grid} as unknown as Room);
        const rand = new RandomNumberGenerator(8);

        for (let i = 0; i < 4000; ++i)
        {
            const subX = rand.randomInt(0, 2 * NUM_VOXEL_COLS), subZ = rand.randomInt(0, 2 * NUM_VOXEL_ROWS);
            const layer = rand.randomInt(0, NUM_COLLISION_LAYERS);

            // A speck in the middle of the sub-block.
            const speck = {
                center: {x: 0.5 * subX + 0.25, y: (layer + 0.5) * COLLISION_LAYER_HEIGHT, z: 0.5 * subZ + 0.25},
                halfSize: {x: 0.01, y: 0.01, z: 0.01},
            };
            const hitsBlock = PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom, speck);
            expect(hitsBlock, `sub-block ${subX},${layer},${subZ}`).toBe(subBlockIsSolid(grid, subX, layer, subZ));
            expect(VoxelQueryUtil.isPointInVoxelBlock(grid.voxels, speck.center)).toBe(hitsBlock);
        }
    });

    it("leave a shrunk block's open half to walk into", () => {
        const ROW = 10, COL = 12;
        const grid = VoxelGrid.createBaseGrid();
        grid.quadsMem.blockShapes.fill(VOXEL_BLOCK_SHAPE_EMPTY);
        setShape(grid, ROW, COL, COLLISION_LAYER_MIN, HALVES[3]); // the higher-z half
        const physicsRoom = new PhysicsRoom({voxelGrid: grid} as unknown as Room);

        const boxAt = (z: number) => ({
            center: {x: COL + 0.5, y: 0.25, z: ROW + z},
            halfSize: {x: 0.2, y: 0.2, z: 0.2},
        });
        expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom, boxAt(0.25))).toBe(false);
        expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom, boxAt(0.75))).toBe(true);

        // Its box is the half it fills.
        const collider = PhysicsColliderStateUtil.getVoxelBlockColliderState(grid.voxels, ROW, COL, COLLISION_LAYER_MIN);
        expect(collider.hitbox.center).toEqual({x: COL + 0.5, y: 0.25, z: ROW + 0.75});
        expect(collider.hitbox.halfSize).toEqual({x: 0.5, y: 0.25, z: 0.25});
    });
});
