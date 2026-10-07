/**
 * Scenario tests: which quads a room draws. That is never stored: a room's blocks decide it (see
 * VoxelQueryUtil.isVoxelQuadVisible), so nothing kept beside them can fall out of step with them.
 * Covers: the rule (a block's faces, the room's floor and ceiling, no outer shell, no caps, never more
 * quads than the voxel mesh has instances for); what an edit announces for redrawing (exactly the quads it
 * covers, uncovers, repaints or gives another rectangle), and the voxel mesh holding an instance for just
 * the drawn quads after it; a repaint never uncovering a face, and a covered face keeping its paint; a
 * quad's spare bit staying clear in memory, and spelling its block's shape in what is encoded. The rule
 * for blocks of other shapes than whole is checked sub-block by sub-block in voxel-block-shape.test.ts.
 */
import { describe, it, expect, vi } from "vitest";

// Nothing here looks through the camera or adds to the scene.
vi.mock("../../../src/client/graphics/graphicsManager", () => {
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {} };
    return { default: { getCamera: () => ({}), getScene: () => ({}), getLightBlockMap: () => lightBlockMap } };
});

vi.mock("../../../src/client/app", () => ({
    default: { getCurrentRoom: vi.fn(), getVoxelQuads: vi.fn(), getUser: vi.fn(), getEnv: vi.fn() },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

// Imported by the modules under test; nothing here needs a running game.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

import VoxelGameObject from "../../../src/client/object/types/gameObject/voxelGameObject";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import BufferState from "../../../src/shared/networking/types/bufferState";
import RandomNumberGenerator from "../../../src/shared/math/types/randomNumberGenerator";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import VoxelBlockShapeUtil from "../../../src/shared/voxel/util/voxelBlockShapeUtil";
import { voxelQuadChangeObservable } from "../../../src/shared/system/sharedObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ENCODED_VOXEL_GRID_BYTES, MAX_VISIBLE_VOXEL_QUADS_PER_ROOM,
    NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM,
    NUM_VOXEL_QUADS_PER_VOXEL,
    NUM_VOXEL_ROWS, NUM_VOXEL_TEXTURES, SANDBOX_SINGLE_PLAYER_MODE, TUTORIAL_SINGLE_PLAYER_MODE,
    VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";

type FacingAxis = "x" | "y" | "z";
type Orientation = "-" | "+";

// The bit of a quad's byte that its texture index leaves over (see Voxel).
const SPARE_QUAD_BIT = 0b10000000;

// The shapes a block can have (see VoxelBlockShapeUtil): whole, the four halves, the four quarters.
const LOW_X_HALF = 0b0101, HIGH_X_HALF = 0b1010, LOW_Z_HALF = 0b0011, HIGH_Z_HALF = 0b1100;
const BLOCK_SHAPES = [VOXEL_BLOCK_SHAPE_WHOLE, LOW_X_HALF, HIGH_X_HALF, LOW_Z_HALF, HIGH_Z_HALF, 1, 2, 4, 8];

// A cell well inside the grid, and a layer well inside its height.
const ROW = 10, COL = 10, LAYER = 5;

function quad(row: number, col: number, axis: FacingAxis, orientation: Orientation, layer: number): number
{
    return VoxelQueryUtil.getVoxelQuadIndex(row, col, axis, orientation, layer);
}

function isVisible(grid: VoxelGrid, quadIndex: number): boolean
{
    return VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex);
}

function visibleQuads(grid: VoxelGrid): number[]
{
    const quadIndices: number[] = [];
    for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
    {
        if (isVisible(grid, quadIndex))
            quadIndices.push(quadIndex);
    }
    return quadIndices;
}

function isSolid(grid: VoxelGrid, row: number, col: number, layer: number): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(grid.voxels, row, col, layer);
}

// As generation edits a room: no room is passed, so nothing is validated.
function addBlock(grid: VoxelGrid, row: number, col: number, layer: number, textures?: number[]): void
{
    VoxelUpdateUtil.addVoxelBlock(undefined, grid.voxels,
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer), textures);
}

function removeBlock(grid: VoxelGrid, row: number, col: number, layer: number): void
{
    VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels,
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer));
}

function reshapeBlock(grid: VoxelGrid, row: number, col: number, layer: number, shape: number): void
{
    VoxelUpdateUtil.setVoxelBlockShape(undefined, grid.voxels,
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer), shape);
}

function openColumn(grid: VoxelGrid, row: number, col: number): void
{
    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        removeBlock(grid, row, col, layer);
}

// Places where a solid block meets an open one inside the grid, counted block by block rather than quad
// by quad: each is one drawn face. Under the lowest layer and over the highest lies solid rock.
function countSolidOpenBoundaries(grid: VoxelGrid): number
{
    let count = 0;
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            for (let layer = COLLISION_LAYER_MIN - 1; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                if (isSolid(grid, row, col, layer) != isSolid(grid, row, col, layer + 1))
                    ++count;
                if (layer < COLLISION_LAYER_MIN)
                    continue;
                if (col + 1 < NUM_VOXEL_COLS && isSolid(grid, row, col, layer) != isSolid(grid, row, col + 1, layer))
                    ++count;
                if (row + 1 < NUM_VOXEL_ROWS && isSolid(grid, row, col, layer) != isSolid(grid, row + 1, col, layer))
                    ++count;
            }
        }
    }
    return count;
}

function generatedRooms(): {name: string, grid: VoxelGrid}[]
{
    return [
        {name: "hub", grid: RoomGenerationUtil.generateRoom("Hub", RoomTypeEnumMap.Hub, "", "", 4242).voxelGrid},
        {name: "regular", grid: RoomGenerationUtil.generateRoom("Regular", RoomTypeEnumMap.Regular, "", "", 91).voxelGrid},
        {name: "tutorial", grid: RoomGenerationUtil.generateRoom(TUTORIAL_SINGLE_PLAYER_MODE,
            RoomTypeEnumMap.SinglePlayer).voxelGrid},
        {name: "sandbox", grid: RoomGenerationUtil.generateRoom(SANDBOX_SINGLE_PLAYER_MODE,
            RoomTypeEnumMap.SinglePlayer).voxelGrid},
    ];
}

const EDIT_KINDS = ["add", "remove", "move", "repaint", "reshape"] as const;
type EditKind = typeof EDIT_KINDS[number];

// One edit of the given kind as the game makes it, at a random place where it makes sense, or undefined if
// none was found.
function drawRandomEdit(grid: VoxelGrid, rand: RandomNumberGenerator, kind: EditKind): (() => void) | undefined
{
    const voxels = grid.voxels;
    for (let attempt = 0; attempt < 200; ++attempt)
    {
        const row = rand.randomInt(0, NUM_VOXEL_ROWS), col = rand.randomInt(0, NUM_VOXEL_COLS);
        const layer = rand.randomInt(0, NUM_COLLISION_LAYERS);
        const blockQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
        const solid = isSolid(grid, row, col, layer);

        if (kind == "add" && !solid)
        {
            const textures = (rand.randomInt(0, 2) == 0) ? undefined
                : Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER}, () => rand.randomInt(0, NUM_VOXEL_TEXTURES));
            const shape = BLOCK_SHAPES[rand.randomInt(0, BLOCK_SHAPES.length)];
            return () => VoxelUpdateUtil.addVoxelBlock(undefined, voxels, blockQuadIndex, textures, undefined, shape);
        }
        if (kind == "reshape" && solid)
        {
            const shape = BLOCK_SHAPES[rand.randomInt(0, BLOCK_SHAPES.length)];
            if (shape != VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, layer))
                return () => VoxelUpdateUtil.setVoxelBlockShape(undefined, voxels, blockQuadIndex, shape);
        }
        if (kind == "remove" && solid)
            return () => VoxelUpdateUtil.removeVoxelBlock(undefined, voxels, blockQuadIndex);
        if (kind == "move" && solid)
        {
            const rowOffset = rand.randomInt(-1, 2), colOffset = rand.randomInt(-1, 2), layerOffset = rand.randomInt(-1, 2);
            const targetLayer = layer + layerOffset;
            if (targetLayer >= COLLISION_LAYER_MIN && targetLayer <= COLLISION_LAYER_MAX &&
                !isSolid(grid, row + rowOffset, col + colOffset, targetLayer)) // (out of the grid counts as solid)
            {
                return () => VoxelUpdateUtil.moveVoxelBlock(undefined, voxels, blockQuadIndex,
                    rowOffset, colOffset, layerOffset);
            }
        }
        if (kind == "repaint")
        {
            // Only a face on show can be repainted.
            const quadIndex = blockQuadIndex + rand.randomInt(0, NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
            const textureIndex = rand.randomInt(0, NUM_VOXEL_TEXTURES);
            if (isVisible(grid, quadIndex))
                return () => VoxelUpdateUtil.setVoxelQuadTexture(undefined, voxels, quadIndex, textureIndex);
        }
    }
    return undefined;
}

// An encoded grid's quad bytes, read by the layout itself rather than by the decoder (see Voxel): those of
// the room's own floor and ceiling, and each stored block's six with the cell layer they are stored for.
function encodedQuads(grid: VoxelGrid): {tiles: number[], blocks: {row: number, col: number, layer: number, quads: number[]}[]}
{
    const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
    grid.encode(out);

    const encoded: ReturnType<typeof encodedQuads> = {tiles: [], blocks: []};
    let byteIndex = 1; // past the version
    for (let voxelIndex = 0; voxelIndex < NUM_VOXEL_ROWS * NUM_VOXEL_COLS; ++voxelIndex)
    {
        encoded.tiles.push(out.view[byteIndex++], out.view[byteIndex++]); // ceiling, floor
        const mask = out.view[byteIndex++] | (out.view[byteIndex++] << 8);
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            if ((mask & (1 << layer)) == 0)
                continue;
            encoded.blocks.push({row: Math.floor(voxelIndex / NUM_VOXEL_COLS), col: voxelIndex % NUM_VOXEL_COLS, layer,
                quads: Array.from(out.view.subarray(byteIndex, byteIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER))});
            byteIndex += NUM_VOXEL_QUADS_PER_COLLISION_LAYER;
        }
    }
    return encoded;
}

describe("the quads a room draws", () => {
    it("are none at all in solid rock", () => {
        expect(visibleQuads(VoxelGrid.createBaseGrid())).toEqual([]);
    });

    it("are the six faces around a block taken out of solid rock, each on the block beyond it", () => {
        const grid = VoxelGrid.createBaseGrid();
        removeBlock(grid, ROW, COL, LAYER);

        expect(visibleQuads(grid).sort((a, b) => a - b)).toEqual([
            quad(ROW, COL, "y", "+", LAYER - 1),
            quad(ROW, COL, "y", "-", LAYER + 1),
            quad(ROW, COL - 1, "x", "+", LAYER),
            quad(ROW, COL + 1, "x", "-", LAYER),
            quad(ROW - 1, COL, "z", "+", LAYER),
            quad(ROW + 1, COL, "z", "-", LAYER),
        ].sort((a, b) => a - b));
    });

    it("are the six faces of a block standing alone in the open, and nothing of what is gone", () => {
        const grid = VoxelGrid.createBaseGrid();
        for (let row = ROW - 1; row <= ROW + 1; ++row)
        {
            for (let col = COL - 1; col <= COL + 1; ++col)
            {
                for (let layer = LAYER - 1; layer <= LAYER + 1; ++layer)
                    removeBlock(grid, row, col, layer);
            }
        }
        addBlock(grid, ROW, COL, LAYER);

        for (const axis of ["x", "y", "z"] as const)
        {
            for (const orientation of ["-", "+"] as const)
            {
                expect(isVisible(grid, quad(ROW, COL, axis, orientation, LAYER)), `${orientation}${axis}`).toBe(true);
                // An open block draws nothing, whatever its quads were left holding.
                expect(isVisible(grid, quad(ROW, COL - 1, axis, orientation, LAYER)), `${orientation}${axis}`).toBe(false);
            }
        }
    });

    it("leave out the outside of the grid, so the room has no outer shell", () => {
        const grid = VoxelGrid.createBaseGrid();
        removeBlock(grid, ROW, 1, LAYER);
        removeBlock(grid, 1, COL, LAYER);
        removeBlock(grid, ROW, NUM_VOXEL_COLS - 2, LAYER);
        removeBlock(grid, NUM_VOXEL_ROWS - 2, COL, LAYER);

        // Each boundary block draws the face it turns to the room, and none to the outside.
        expect(isVisible(grid, quad(ROW, 0, "x", "+", LAYER))).toBe(true);
        expect(isVisible(grid, quad(ROW, 0, "x", "-", LAYER))).toBe(false);
        expect(isVisible(grid, quad(0, COL, "z", "+", LAYER))).toBe(true);
        expect(isVisible(grid, quad(0, COL, "z", "-", LAYER))).toBe(false);
        expect(isVisible(grid, quad(ROW, NUM_VOXEL_COLS - 1, "x", "-", LAYER))).toBe(true);
        expect(isVisible(grid, quad(ROW, NUM_VOXEL_COLS - 1, "x", "+", LAYER))).toBe(false);
        expect(isVisible(grid, quad(NUM_VOXEL_ROWS - 1, COL, "z", "-", LAYER))).toBe(true);
        expect(isVisible(grid, quad(NUM_VOXEL_ROWS - 1, COL, "z", "+", LAYER))).toBe(false);

        // Nor does taking a boundary block out put anything in its place.
        removeBlock(grid, ROW, 0, LAYER);
        expect(isVisible(grid, quad(ROW, 0, "x", "-", LAYER))).toBe(false);
        expect(isVisible(grid, quad(ROW, 0, "x", "+", LAYER))).toBe(false);
    });

    it("include the room's floor and ceiling over a cell open down to one or up to the other", () => {
        const grid = VoxelGrid.createBaseGrid();
        const floor = VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL);
        const ceiling = VoxelQueryUtil.getCeilingVoxelQuadIndex(ROW, COL);
        expect(isVisible(grid, floor)).toBe(false);
        expect(isVisible(grid, ceiling)).toBe(false);

        removeBlock(grid, ROW, COL, COLLISION_LAYER_MIN);
        expect(isVisible(grid, floor)).toBe(true);
        expect(isVisible(grid, ceiling)).toBe(false);

        removeBlock(grid, ROW, COL, COLLISION_LAYER_MAX);
        expect(isVisible(grid, ceiling)).toBe(true);

        // A block standing on the floor covers it, and one hanging from the ceiling covers that.
        addBlock(grid, ROW, COL, COLLISION_LAYER_MIN);
        addBlock(grid, ROW, COL, COLLISION_LAYER_MAX);
        expect(isVisible(grid, floor)).toBe(false);
        expect(isVisible(grid, ceiling)).toBe(false);
    });

    it("leave out the caps of blocks reaching the room's floor or ceiling", () => {
        const grid = VoxelGrid.createBaseGrid();
        openColumn(grid, ROW, COL);
        addBlock(grid, ROW, COL, COLLISION_LAYER_MIN);
        addBlock(grid, ROW, COL, COLLISION_LAYER_MAX);

        // Each shows the face it turns into the room, and none the other way.
        expect(isVisible(grid, quad(ROW, COL, "y", "+", COLLISION_LAYER_MIN))).toBe(true);
        expect(isVisible(grid, quad(ROW, COL, "y", "-", COLLISION_LAYER_MIN))).toBe(false);
        expect(isVisible(grid, quad(ROW, COL, "y", "-", COLLISION_LAYER_MAX))).toBe(true);
        expect(isVisible(grid, quad(ROW, COL, "y", "+", COLLISION_LAYER_MAX))).toBe(false);
    });

    it("are one for every place a solid block meets an open one, in every generated room", () => {
        for (const {name, grid} of generatedRooms())
            expect(visibleQuads(grid).length, name).toBe(countSolidOpenBoundaries(grid));
    });

    it("never outnumber the instances the voxel mesh has, however the blocks lie", () => {
        // Blocks alternating in all three directions meet an open one on every side they have.
        const checkered = VoxelGrid.createBaseGrid();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((row + col + layer) % 2 == 0)
                        removeBlock(checkered, row, col, layer);
                }
            }
        }
        expect(visibleQuads(checkered).length).toBe(countSolidOpenBoundaries(checkered));
        expect(visibleQuads(checkered).length).toBeLessThanOrEqual(MAX_VISIBLE_VOXEL_QUADS_PER_ROOM);

        const open = VoxelGrid.createBaseGrid();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                openColumn(open, row, col);
        }
        expect(visibleQuads(open).length).toBe(2 * NUM_VOXEL_ROWS * NUM_VOXEL_COLS); // floor and ceiling only
    });

    it("are none for a quad index outside the room", () => {
        const grid = RoomGenerationUtil.generateRoom("Hub", RoomTypeEnumMap.Hub, "", "", 3).voxelGrid;
        for (const quadIndex of [-1, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_ROOM + 12345])
            expect(isVisible(grid, quadIndex), `${quadIndex}`).toBe(false);
    });
});

describe("what an edit announces for redrawing", () => {
    // The voxel mesh redraws only the quads announced (see ClientVoxelManager), and a quad covered or
    // uncovered by a neighbouring block doesn't change in itself.
    function announcedBy(edit: () => void): number[]
    {
        const announced: number[] = [];
        voxelQuadChangeObservable.addListener("test-spy", change => { announced.push(change.quadIndex); });
        try
        {
            edit();
        }
        finally
        {
            voxelQuadChangeObservable.removeListener("test-spy");
        }
        return announced;
    }

    interface Snapshot
    {
        visible: boolean[];
        quads: Uint8Array;
        blockShapes: Uint8Array;
    }

    function snapshot(grid: VoxelGrid): Snapshot
    {
        const visible = new Array<boolean>(NUM_VOXEL_QUADS_PER_ROOM);
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            visible[quadIndex] = isVisible(grid, quadIndex);
        return {visible, quads: grid.quadsMem.quads.slice(), blockShapes: grid.quadsMem.blockShapes.slice()};
    }

    // Where a block of the given shape has the face a quad stands for: the plane it lies in and its reach
    // across it, in the cell's own terms. The room's floor and ceiling quads are of no block.
    function faceRectangle(quadIndex: number, shape: number): string
    {
        const bounds = VoxelBlockShapeUtil.getBounds(shape);
        const face = (quadIndex % NUM_VOXEL_QUADS_PER_VOXEL) % NUM_VOXEL_QUADS_PER_COLLISION_LAYER;
        switch (face)
        {
            case 0: case 1: return `${bounds.minX},${bounds.maxX},${bounds.minZ},${bounds.maxZ}`;
            case 2: return `${bounds.minX},${bounds.minZ},${bounds.maxZ}`;
            case 3: return `${bounds.maxX},${bounds.minZ},${bounds.maxZ}`;
            case 4: return `${bounds.minZ},${bounds.minX},${bounds.maxX}`;
            default: return `${bounds.maxZ},${bounds.minX},${bounds.maxX}`;
        }
    }

    // The quads drawn differently: covered, uncovered, repainted (drawn or not, since a covered face keeps
    // its paint), or drawn as another rectangle because their block has another shape.
    function changedBetween(before: Snapshot, after: Snapshot): number[]
    {
        const changed: number[] = [];
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            if (after.visible[quadIndex] != before.visible[quadIndex] || after.quads[quadIndex] != before.quads[quadIndex])
            {
                changed.push(quadIndex);
                continue;
            }
            const layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
            if (!after.visible[quadIndex] || layer > COLLISION_LAYER_MAX)
                continue;
            const blockIndex = VoxelQueryUtil.getVoxelBlockIndex(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
                VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), layer);
            if (before.blockShapes[blockIndex] != after.blockShapes[blockIndex] &&
                faceRectangle(quadIndex, before.blockShapes[blockIndex]) != faceRectangle(quadIndex, after.blockShapes[blockIndex]))
            {
                changed.push(quadIndex);
            }
        }
        return changed;
    }

    it("is the six quads uncovered around a block taken out of solid rock", () => {
        const grid = VoxelGrid.createBaseGrid();
        const announced = announcedBy(() => removeBlock(grid, ROW, COL, LAYER));
        expect(announced.sort((a, b) => a - b)).toEqual(visibleQuads(grid).sort((a, b) => a - b));
    });

    it("is the room's floor when the block standing on it goes, and again when one comes back", () => {
        const grid = VoxelGrid.createBaseGrid();
        const floor = VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL);
        expect(announcedBy(() => removeBlock(grid, ROW, COL, COLLISION_LAYER_MIN))).toContain(floor);
        expect(announcedBy(() => addBlock(grid, ROW, COL, COLLISION_LAYER_MIN))).toContain(floor);
    });

    it("is nothing when the edit changes nothing", () => {
        const grid = VoxelGrid.createBaseGrid();
        expect(announcedBy(() => addBlock(grid, ROW, COL, LAYER))).toEqual([]); // solid already
        expect(announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, VOXEL_BLOCK_SHAPE_WHOLE))).toEqual([]); // whole already
        removeBlock(grid, ROW, COL, LAYER);
        expect(announcedBy(() => removeBlock(grid, ROW, COL, LAYER))).toEqual([]); // open already
    });

    it("is the faces a block shrunk in solid rock uncovers, on itself and on the blocks around it", () => {
        // Its low-x half stays, so room opens up beside it on the high-x side.
        const grid = VoxelGrid.createBaseGrid();
        const announced = announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, LOW_X_HALF));
        expect(announced.sort((a, b) => a - b)).toEqual([
            // Its own face into the gap, which no longer lies against the block beyond...
            quad(ROW, COL, "x", "+", LAYER),
            // ...and that block's face, with the four around the gap that the half no longer covers whole.
            quad(ROW, COL + 1, "x", "-", LAYER),
            quad(ROW - 1, COL, "z", "+", LAYER),
            quad(ROW + 1, COL, "z", "-", LAYER),
            quad(ROW, COL, "y", "+", LAYER - 1),
            quad(ROW, COL, "y", "-", LAYER + 1),
        ].sort((a, b) => a - b));
        // (Its other five stay covered: each lies wholly against a whole block.)
        expect(visibleQuads(grid).sort((a, b) => a - b)).toEqual([...announced].sort((a, b) => a - b));

        // Grown back, the same six are covered again.
        expect(announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, VOXEL_BLOCK_SHAPE_WHOLE)).sort((a, b) => a - b))
            .toEqual([...announced].sort((a, b) => a - b));
        expect(visibleQuads(grid)).toEqual([]);
    });

    it("is the faces of a block standing in the open that its new shape draws elsewhere", () => {
        const grid = VoxelGrid.createBaseGrid();
        for (let row = ROW - 1; row <= ROW + 1; ++row)
        {
            for (let col = COL - 1; col <= COL + 1; ++col)
            {
                for (let layer = LAYER - 1; layer <= LAYER + 1; ++layer)
                    removeBlock(grid, row, col, layer);
            }
        }
        addBlock(grid, ROW, COL, LAYER);

        // Shrunk to its low-x half: the face on that side stays exactly where and as it was.
        expect(announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, LOW_X_HALF)).sort((a, b) => a - b)).toEqual([
            quad(ROW, COL, "y", "-", LAYER), quad(ROW, COL, "y", "+", LAYER),
            quad(ROW, COL, "x", "+", LAYER),
            quad(ROW, COL, "z", "-", LAYER), quad(ROW, COL, "z", "+", LAYER),
        ].sort((a, b) => a - b));

        // Slid to the other half: now both faces across x move, and the rest with them.
        expect(announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, HIGH_X_HALF)).length).toBe(6);

        // Halved again along z: the face at the high-z end stays put only if that end is the half kept.
        expect(announcedBy(() => reshapeBlock(grid, ROW, COL, LAYER, HIGH_X_HALF & HIGH_Z_HALF)).sort((a, b) => a - b))
            .toEqual([
                quad(ROW, COL, "y", "-", LAYER), quad(ROW, COL, "y", "+", LAYER),
                quad(ROW, COL, "x", "-", LAYER), quad(ROW, COL, "x", "+", LAYER),
                quad(ROW, COL, "z", "-", LAYER),
            ].sort((a, b) => a - b));
    });

    it("is exactly the quads covered, uncovered, repainted or given another rectangle, over a run of random edits", () => {
        // Blocks solid or open at random, so that every kind of edit finds places to be made.
        const rand = new RandomNumberGenerator(20261006);
        const grid = VoxelGrid.createBaseGrid();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if (rand.randomInt(0, 2) == 0)
                        removeBlock(grid, row, col, layer);
                }
            }
        }
        // Compared over the whole room each time, so a quad changing unannounced anywhere is caught.
        let before = snapshot(grid);
        for (let i = 0; i < 75; ++i)
        {
            const kind = EDIT_KINDS[i % EDIT_KINDS.length];
            const edit = drawRandomEdit(grid, rand, kind);
            expect(edit, `no place found to ${kind}`).toBeDefined();

            const announced = announcedBy(edit!);
            const after = snapshot(grid);
            const changed = changedBetween(before, after);
            before = after;

            if (kind == "move")
            {
                // A move is an add then a remove, and a quad between the two blocks can change twice over.
                for (const quadIndex of changed)
                    expect(announced, `${kind} (edit ${i})`).toContain(quadIndex);
            }
            else
            {
                expect(announced.sort((a, b) => a - b), `${kind} (edit ${i})`).toEqual(changed);
            }
        }
    });
});

describe("the voxel mesh", () => {
    // It lends an instance to each drawn quad and takes it back once the quad is covered (see
    // VoxelQuadInstanceUtil), hearing of either only through what an edit announces.
    it("holds an instance for exactly the quads the room draws, through a run of edits", () => {
        const grid = RoomGenerationUtil.generateRoom("Hub", RoomTypeEnumMap.Hub, "", "", 104729).voxelGrid;
        const voxels = grid.voxels;

        // Voxel game objects bound to the grid as ClientObjectUtil binds them, over a pool that only counts.
        let numInstancesMade = 0;
        const freeInstanceIds: number[] = [];
        const instancedMeshGraphics = {
            rentInstanceFromPool: () => freeInstanceIds.pop() ?? numInstancesMade++,
            returnInstanceToPool: (_instancedMeshId: string, instanceId: number) => { freeInstanceIds.push(instanceId); },
            updateInstanceTransform: () => {},
            updateInstanceTextureRect: () => {},
        };
        const gameObjects = voxels.map(voxel => Object.assign(Object.create(VoxelGameObject.prototype),
            {voxel, voxels, instancedMeshGraphics}) as VoxelGameObject);

        const expectInstancesOnDrawnQuadsOnly = (when: string) => {
            const mismatched: number[] = [];
            for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            {
                if ((VoxelQuadInstanceUtil.getInstanceId(quadIndex) >= 0) != isVisible(grid, quadIndex))
                    mismatched.push(quadIndex);
            }
            expect(mismatched, when).toEqual([]);
        };

        // As ClientVoxelManager hands a change to the voxel it belongs to.
        voxelQuadChangeObservable.addListener("test-mesh", change => {
            const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(change.quadIndex);
            const col = VoxelQueryUtil.getVoxelColFromQuadIndex(change.quadIndex);
            void gameObjects[row * NUM_VOXEL_COLS + col].applyVoxelQuadChange(change);
        });
        try
        {
            for (const gameObject of gameObjects)
                gameObject.refreshAllQuads();
            expectInstancesOnDrawnQuadsOnly("as the room spawns");

            const rand = new RandomNumberGenerator(31);
            for (let i = 0; i < 2000; ++i)
            {
                drawRandomEdit(grid, rand, EDIT_KINDS[i % EDIT_KINDS.length])?.();
                if (i % 250 == 249)
                    expectInstancesOnDrawnQuadsOnly(`after ${i + 1} edits`);
            }
            expect(numInstancesMade - freeInstanceIds.length).toBe(visibleQuads(grid).length);
        }
        finally
        {
            voxelQuadChangeObservable.removeListener("test-mesh");
            for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            {
                const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
                if (instanceId >= 0)
                    VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
            }
        }
    });
});

describe("a quad's texture", () => {
    it("never uncovers the quad, even set without the checks an edit of the user's gets", () => {
        // The path a relayed edit takes (see ClientVoxelManager.setVoxelQuadTexture).
        const grid = VoxelGrid.createBaseGrid();
        const buried = quad(ROW, COL, "x", "+", LAYER);
        expect(VoxelUpdateUtil.setVoxelQuadTexture(undefined, grid.voxels, buried, 7)).toBe(true);

        expect(grid.quadsMem.quads[buried]).toBe(7);
        expect(isVisible(grid, buried)).toBe(false);
        expect(visibleQuads(grid)).toEqual([]);
    });

    it("stays on a covered quad for when it is uncovered again", () => {
        const grid = VoxelGrid.createBaseGrid();
        removeBlock(grid, ROW, COL, LAYER);
        const wall = quad(ROW, COL - 1, "x", "+", LAYER);
        VoxelUpdateUtil.setVoxelQuadTexture(undefined, grid.voxels, wall, 42);

        addBlock(grid, ROW, COL, LAYER, [1, 1, 1, 1, 1, 1]);
        expect(isVisible(grid, wall)).toBe(false);
        removeBlock(grid, ROW, COL, LAYER);
        expect(isVisible(grid, wall)).toBe(true);
        expect(grid.quadsMem.quads[wall]).toBe(42);
    });

    it("leaves the spare bit clear when the index asked for is too wide", () => {
        // A signal carries the index as a whole byte.
        const grid = VoxelGrid.createBaseGrid();
        removeBlock(grid, ROW, COL, LAYER);
        const wall = quad(ROW, COL - 1, "x", "+", LAYER);
        VoxelUpdateUtil.setVoxelQuadTexture(undefined, grid.voxels, wall, 0b11111111);
        expect(grid.quadsMem.quads[wall]).toBe(0b01111111);

        addBlock(grid, ROW, COL, LAYER, [255, 255, 255, 255, 255, 255]);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        {
            expect(grid.quadsMem.quads[VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(ROW, COL, LAYER) + i])
                .toBe(0b01111111);
        }
    });
});

describe("a quad's spare bit", () => {
    // In memory a quad is its texture index and nothing else: a block's shape is kept beside the quads (see
    // VoxelQuadsRuntimeMemory), so no texture writer can disturb it. Encoded, the four side quads of a
    // block each say whether one of its sub-blocks is cut away, which costs a whole block's bytes nothing.
    function expectSpareBitsSpellShapes(grid: VoxelGrid, what: string): void
    {
        expect(grid.quadsMem.quads.every(quadByte => (quadByte & SPARE_QUAD_BIT) == 0), `${what}, in memory`).toBe(true);

        const encoded = encodedQuads(grid);
        expect(encoded.tiles.every(quadByte => (quadByte & SPARE_QUAD_BIT) == 0), `${what}, the room's floor and ceiling`)
            .toBe(true);
        const misspelt: string[] = [];
        for (const {row, col, layer, quads} of encoded.blocks)
        {
            // Bottom, top, then one side quad for each sub-block (bit = x half + 2 * z half).
            const shape = VoxelQueryUtil.getVoxelBlockShapeAt(grid.voxels, row, col, layer);
            let spelt = 0;
            for (let subBlock = 0; subBlock < 4; ++subBlock)
            {
                if ((quads[2 + subBlock] & SPARE_QUAD_BIT) == 0)
                    spelt |= (1 << subBlock);
            }
            if (spelt != shape || (quads[0] & SPARE_QUAD_BIT) != 0 || (quads[1] & SPARE_QUAD_BIT) != 0)
                misspelt.push(`${row},${col},${layer}: holds ${shape}, encoded as ${spelt}`);
        }
        expect(misspelt, `${what}, encoded`).toEqual([]);
    }

    it("is clear throughout every generated room, whose blocks are all whole", () => {
        for (const {name, grid} of generatedRooms())
        {
            expectSpareBitsSpellShapes(grid, name);
            const encoded = encodedQuads(grid);
            expect(encoded.blocks.every(block => block.quads.every(quadByte => (quadByte & SPARE_QUAD_BIT) == 0)), name)
                .toBe(true);
        }
    });

    it("spells each block's shape through edits, and the room comes back from its encoding as it was", () => {
        const grid = RoomGenerationUtil.generateRoom("Regular", RoomTypeEnumMap.Regular, "", "", 999983).voxelGrid;
        const rand = new RandomNumberGenerator(7);
        for (let i = 0; i < 2000; ++i)
            drawRandomEdit(grid, rand, EDIT_KINDS[i % EDIT_KINDS.length])?.();
        expectSpareBitsSpellShapes(grid, "edited room");
        // (The run leaves blocks of every shape standing.)
        const shapesHeld = new Set(grid.quadsMem.blockShapes);
        for (const shape of BLOCK_SHAPES)
            expect(shapesHeld.has(shape), `no block of shape ${shape} came of the edits`).toBe(true);

        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        grid.encode(out);
        const reloaded = VoxelGrid.decode(new BufferState(out.view.slice(0, out.byteIndex))) as VoxelGrid;
        expect(Array.from(reloaded.quadsMem.blockShapes)).toEqual(Array.from(grid.quadsMem.blockShapes));
        expect(reloaded.voxels.map((voxel: Voxel) => VoxelQueryUtil.getVoxelBlockLayerMask(voxel)))
            .toEqual(grid.voxels.map(voxel => VoxelQueryUtil.getVoxelBlockLayerMask(voxel)));
        expect(visibleQuads(reloaded)).toEqual(visibleQuads(grid));
        for (const quadIndex of visibleQuads(grid))
            expect(reloaded.quadsMem.quads[quadIndex]).toBe(grid.quadsMem.quads[quadIndex]);
        expectSpareBitsSpellShapes(reloaded, "reloaded room");
    });
});
