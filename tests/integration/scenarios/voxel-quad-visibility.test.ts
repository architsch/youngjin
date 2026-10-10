/**
 * Scenario tests: which quads a room draws. That is never stored: a room's blocks decide it (see
 * VoxelQueryUtil.isVoxelQuadVisible), so nothing kept beside them can fall out of step with them.
 * Covers: the rule (a block's faces, the room's floor and ceiling, no outer shell, no caps, never more
 * quads than the voxel mesh has instances for); what an edit announces for redrawing (exactly the quads it
 * covers, uncovers or repaints), and the voxel mesh holding an instance for just the drawn quads after it;
 * a repaint never uncovering a face, and a covered face keeping its paint; a quad's spare bit staying
 * clear, in memory and in what is encoded.
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
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import { createTestRoom } from "../helpers/roomContent";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import BufferState from "../../../src/shared/networking/types/bufferState";
import RandomNumberGenerator from "../../../src/shared/math/types/randomNumberGenerator";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { voxelQuadChangeObservable } from "../../../src/shared/system/sharedObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ENCODED_VOXEL_GRID_BYTES,
    MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_ROWS, NUM_VOXEL_TEXTURES, SANDBOX_SINGLE_PLAYER_MODE,
    TUTORIAL_SINGLE_PLAYER_MODE, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";

type FacingAxis = "x" | "y" | "z";
type Orientation = "-" | "+";

// The bit of a quad's byte that its texture index leaves over (see Voxel).
const SPARE_QUAD_BIT = 0b10000000;

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

// A room as the server makes one: empty.
function generatedGrid(): VoxelGrid
{
    return RoomGenerationUtil.generateRoom("Room", RoomTypeEnumMap.Regular).voxelGrid;
}

// A single-player room's, read from its file: the tutorial's is spaces cut out of rock, the sandbox's all open.
function singlePlayerGrid(singlePlayerMode: string): VoxelGrid
{
    return createTestRoom(singlePlayerMode, singlePlayerMode, RoomTypeEnumMap.SinglePlayer).voxelGrid;
}

function generatedRooms(): {name: string, grid: VoxelGrid}[]
{
    return [
        {name: "generated", grid: generatedGrid()},
        {name: "tutorial", grid: singlePlayerGrid(TUTORIAL_SINGLE_PLAYER_MODE)},
        {name: "sandbox", grid: singlePlayerGrid(SANDBOX_SINGLE_PLAYER_MODE)},
    ];
}

const EDIT_KINDS = ["add", "remove", "move", "repaint"] as const;
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
            return () => VoxelUpdateUtil.addVoxelBlock(undefined, voxels, blockQuadIndex, textures);
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

// A grid as it is encoded, and where its quad bytes lie in that, found by the layout itself rather than by
// the decoder (see Voxel): those of the room's own floor and ceiling, and each stored block's six.
function encodeWithQuadByteIndices(grid: VoxelGrid): {bytes: Uint8Array, quadByteIndices: number[]}
{
    const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
    grid.encode(out);

    const quadByteIndices: number[] = [];
    let byteIndex = 1; // past the version
    for (let voxelIndex = 0; voxelIndex < NUM_VOXEL_ROWS * NUM_VOXEL_COLS; ++voxelIndex)
    {
        quadByteIndices.push(byteIndex++, byteIndex++); // ceiling, floor
        const mask = out.view[byteIndex++] | (out.view[byteIndex++] << 8);
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            if ((mask & (1 << layer)) == 0)
                continue;
            for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                quadByteIndices.push(byteIndex++);
        }
    }
    // (Nothing follows the voxels.)
    expect(byteIndex).toBe(out.byteIndex);
    return {bytes: out.view.slice(0, out.byteIndex), quadByteIndices};
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
        const grid = generatedGrid();
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
    }

    function snapshot(grid: VoxelGrid): Snapshot
    {
        const visible = new Array<boolean>(NUM_VOXEL_QUADS_PER_ROOM);
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            visible[quadIndex] = isVisible(grid, quadIndex);
        return {visible, quads: grid.quadsMem.quads.slice()};
    }

    // The quads drawn differently: covered, uncovered, or repainted (drawn or not, since a covered face
    // keeps its paint).
    function changedBetween(before: Snapshot, after: Snapshot): number[]
    {
        const changed: number[] = [];
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            if (after.visible[quadIndex] != before.visible[quadIndex] || after.quads[quadIndex] != before.quads[quadIndex])
                changed.push(quadIndex);
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
        removeBlock(grid, ROW, COL, LAYER);
        expect(announcedBy(() => removeBlock(grid, ROW, COL, LAYER))).toEqual([]); // open already
    });

    it("is a block's own faces where they look into the open, and the face it covers on a block beside it", () => {
        // Open space all round the cell, but for one block beside it.
        const grid = VoxelGrid.createBaseGrid();
        for (let row = ROW - 1; row <= ROW + 1; ++row)
        {
            for (let col = COL - 1; col <= COL + 1; ++col)
            {
                for (let layer = LAYER - 1; layer <= LAYER + 1; ++layer)
                    removeBlock(grid, row, col, layer);
            }
        }
        addBlock(grid, ROW, COL - 1, LAYER);

        const announced = announcedBy(() => addBlock(grid, ROW, COL, LAYER));
        expect(announced.sort((a, b) => a - b)).toEqual([
            quad(ROW, COL, "y", "-", LAYER), quad(ROW, COL, "y", "+", LAYER),
            quad(ROW, COL, "x", "+", LAYER),
            quad(ROW, COL, "z", "-", LAYER), quad(ROW, COL, "z", "+", LAYER),
            // Its face against the other block is never drawn: that block's, which it covers, stands in for it.
            quad(ROW, COL - 1, "x", "+", LAYER),
        ].sort((a, b) => a - b));

        // Taken away again, the same six: its own are lost, and the other block's is bared.
        expect(announcedBy(() => removeBlock(grid, ROW, COL, LAYER)).sort((a, b) => a - b)).toEqual(announced);
    });

    it("is the faces given another texture, drawn or not, when a block is put up where one stands", () => {
        // As a relayed edit or the server's correction of one may be (see VoxelUpdateUtil.addVoxelBlock).
        const grid = VoxelGrid.createBaseGrid();
        removeBlock(grid, ROW, COL + 1, LAYER); // (bares the face the block turns to +x, and no other)
        const top = quad(ROW, COL, "y", "+", LAYER), bared = quad(ROW, COL, "x", "+", LAYER);
        const textures = [0, 5, 0, 6, 0, 0]; // [-y, +y, -x, +x, -z, +z], over faces all holding the first

        expect(announcedBy(() => addBlock(grid, ROW, COL, LAYER, textures)).sort((a, b) => a - b))
            .toEqual([top, bared].sort((a, b) => a - b));
        expect([grid.quadsMem.quads[top], grid.quadsMem.quads[bared]]).toEqual([5, 6]);
        expect([isVisible(grid, top), isVisible(grid, bared)]).toEqual([false, true]);

        // Put up once more as it is, there is nothing to draw again.
        expect(announcedBy(() => addBlock(grid, ROW, COL, LAYER, textures))).toEqual([]);
    });

    it("is exactly the quads covered, uncovered or repainted, over a run of random edits", () => {
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
    // Voxel game objects bound to a grid as ClientObjectUtil binds them, one to each patch of the floor plan,
    // over a pool that only counts and remembers where each instance was last put in the world.
    function makeVoxelMesh(grid: VoxelGrid)
    {
        let numInstancesMade = 0;
        const freeInstanceIds: number[] = [];
        const worldPosByInstanceId = new Map<number, {x: number, y: number, z: number}>();
        const gameObjectById: {[objectId: string]: VoxelGameObject} = {};

        const numVoxelsPerSide = VoxelGameObject.numVoxelsPerSide;
        for (let rowStart = 0; rowStart < NUM_VOXEL_ROWS; rowStart += numVoxelsPerSide)
        {
            for (let colStart = 0; colStart < NUM_VOXEL_COLS; colStart += numVoxelsPerSide)
            {
                // Each stands at the middle of its patch.
                const pos = {x: (colStart + 0.5 * numVoxelsPerSide) * VOXEL_CELL_SIZE, y: 0,
                    z: (rowStart + 0.5 * numVoxelsPerSide) * VOXEL_CELL_SIZE};
                const objectId = `voxels-${rowStart}-${colStart}`;
                const gameObject = Object.assign(Object.create(VoxelGameObject.prototype), {
                    params: {objectId, transform: {pos}},
                    instancedMeshGraphics: {
                        rentInstanceFromPool: () => freeInstanceIds.pop() ?? numInstancesMade++,
                        returnInstanceToPool: (_instancedMeshId: string, instanceId: number) => { freeInstanceIds.push(instanceId); },
                        // A part is placed from its object's own position (see InstancedPartUtil.bakePartMatrix).
                        updateInstanceTransform: (_instancedMeshId: string, instanceId: number,
                            offsetX: number, offsetY: number, offsetZ: number) => {
                            worldPosByInstanceId.set(instanceId, {x: pos.x + offsetX, y: pos.y + offsetY, z: pos.z + offsetZ});
                        },
                        updateInstanceTextureRect: () => {},
                    },
                }) as VoxelGameObject;
                gameObject.setVoxels(grid.voxels, rowStart, colStart);
                gameObjectById[objectId] = gameObject;
            }
        }

        // As ClientVoxelManager hands a change to the object of the voxel it belongs to, in the room's grid.
        let boundGrid = grid;
        voxelQuadChangeObservable.addListener("test-mesh", change => {
            const voxel = VoxelQueryUtil.getVoxel(boundGrid.voxels, VoxelQueryUtil.getVoxelRowFromQuadIndex(change.quadIndex),
                VoxelQueryUtil.getVoxelColFromQuadIndex(change.quadIndex))!;
            void gameObjectById[voxel.gameObjectId].applyVoxelQuadChange(change);
        });
        const gameObjects = Object.values(gameObjectById);
        return {
            gameObjects,
            // As ClientObjectManager binds them to the grid of the room arrived in.
            rebind: (nextGrid: VoxelGrid) => {
                boundGrid = nextGrid;
                for (const gameObject of gameObjects)
                    gameObject.rebindVoxels(nextGrid.voxels);
            },
            numInstancesHeld: () => numInstancesMade - freeInstanceIds.length,
            worldPosOf: (quadIndex: number) => worldPosByInstanceId.get(VoxelQuadInstanceUtil.getInstanceId(quadIndex)),
            dispose: () => {
                voxelQuadChangeObservable.removeListener("test-mesh");
                for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
                {
                    const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
                    if (instanceId >= 0)
                        VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
                }
            },
        };
    }

    function expectInstancesOnDrawnQuadsOnly(grid: VoxelGrid, when: string): void
    {
        const mismatched: number[] = [];
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            if ((VoxelQuadInstanceUtil.getInstanceId(quadIndex) >= 0) != isVisible(grid, quadIndex))
                mismatched.push(quadIndex);
        }
        expect(mismatched, when).toEqual([]);
    }

    // It lends an instance to each drawn quad and takes it back once the quad is covered (see
    // VoxelQuadInstanceUtil), hearing of either only through what an edit announces.
    it("holds an instance for exactly the quads the room draws, through a run of edits", () => {
        const grid = generatedGrid();
        const mesh = makeVoxelMesh(grid);
        try
        {
            for (const gameObject of mesh.gameObjects)
                gameObject.refreshAllQuads();
            expectInstancesOnDrawnQuadsOnly(grid, "as the room spawns");

            const rand = new RandomNumberGenerator(31);
            for (let i = 0; i < 2000; ++i)
            {
                drawRandomEdit(grid, rand, EDIT_KINDS[i % EDIT_KINDS.length])?.();
                if (i % 250 == 249)
                    expectInstancesOnDrawnQuadsOnly(grid, `after ${i + 1} edits`);
            }
            expect(mesh.numInstancesHeld()).toBe(visibleQuads(grid).length);
        }
        finally
        {
            mesh.dispose();
        }
    });

    it("is drawn by far fewer objects than the room has voxels, each voxel by the one whose patch it lies in", () => {
        const grid = singlePlayerGrid(TUTORIAL_SINGLE_PLAYER_MODE);
        const mesh = makeVoxelMesh(grid);
        try
        {
            const numVoxelsPerSide = VoxelGameObject.numVoxelsPerSide;
            expect(numVoxelsPerSide).toBeGreaterThan(1);
            expect(mesh.gameObjects.length).toBe(grid.voxels.length / (numVoxelsPerSide * numVoxelsPerSide));

            for (const voxel of grid.voxels)
            {
                const rowStart = voxel.row - voxel.row % numVoxelsPerSide, colStart = voxel.col - voxel.col % numVoxelsPerSide;
                expect(voxel.gameObjectId, `voxel (${voxel.row}, ${voxel.col})`).toBe(`voxels-${rowStart}-${colStart}`);
            }
        }
        finally
        {
            mesh.dispose();
        }
    });

    it("puts each quad where it lies in the room, whichever object draws it", () => {
        const grid = singlePlayerGrid(TUTORIAL_SINGLE_PLAYER_MODE);
        const mesh = makeVoxelMesh(grid);
        try
        {
            for (const gameObject of mesh.gameObjects)
                gameObject.refreshAllQuads();

            const drawn = visibleQuads(grid);
            expect(drawn.length).toBeGreaterThan(500);
            const misplaced: number[] = [];
            for (const quadIndex of drawn)
            {
                // Where the quad lies: by its own voxel's middle (see VoxelQuadTransformDimensions).
                const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex);
                const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
                const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
                const expected = {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(col) + dims.offsetX, y: dims.offsetY,
                    z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(row) + dims.offsetZ};
                const pos = mesh.worldPosOf(quadIndex)!;
                if (Math.hypot(pos.x - expected.x, pos.y - expected.y, pos.z - expected.z) > 1e-9)
                    misplaced.push(quadIndex);
            }
            expect(misplaced).toEqual([]);
        }
        finally
        {
            mesh.dispose();
        }
    });

    it("shows another room's voxels once its objects are bound to that room's grid", () => {
        const first = singlePlayerGrid(TUTORIAL_SINGLE_PLAYER_MODE);
        const second = generatedGrid();
        expect(visibleQuads(second)).not.toEqual(visibleQuads(first));

        const mesh = makeVoxelMesh(first);
        try
        {
            for (const gameObject of mesh.gameObjects)
                gameObject.refreshAllQuads();
            mesh.rebind(second);

            expectInstancesOnDrawnQuadsOnly(second, "after the room change");
            expect(mesh.numInstancesHeld()).toBe(visibleQuads(second).length);
            expect(second.voxels.every(voxel => voxel.gameObjectId ==
                first.voxels[voxel.row * NUM_VOXEL_COLS + voxel.col].gameObjectId)).toBe(true);

            // And hears of that room's edits from then on.
            const rand = new RandomNumberGenerator(5);
            for (let i = 0; i < 200; ++i)
                drawRandomEdit(second, rand, EDIT_KINDS[i % EDIT_KINDS.length])?.();
            expectInstancesOnDrawnQuadsOnly(second, "after edits of the room arrived in");
        }
        finally
        {
            mesh.dispose();
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
    // A quad is its texture index and nothing else, in memory and encoded (see Voxel): the bit its byte
    // has to spare is never set, and one found set in what is read is dropped.
    function expectSpareBitsClear(grid: VoxelGrid, what: string): void
    {
        expect(grid.quadsMem.quads.every(quadByte => (quadByte & SPARE_QUAD_BIT) == 0), `${what}, in memory`).toBe(true);

        const {bytes, quadByteIndices} = encodeWithQuadByteIndices(grid);
        expect(quadByteIndices.every(byteIndex => (bytes[byteIndex] & SPARE_QUAD_BIT) == 0), `${what}, encoded`)
            .toBe(true);
    }

    it("is clear throughout every generated room", () => {
        for (const {name, grid} of generatedRooms())
            expectSpareBitsClear(grid, name);
    });

    it("stays clear through edits and in what is read, and the room comes back from its encoding as it was", () => {
        const grid = singlePlayerGrid(TUTORIAL_SINGLE_PLAYER_MODE);
        const rand = new RandomNumberGenerator(7);
        for (let i = 0; i < 2000; ++i)
            drawRandomEdit(grid, rand, EDIT_KINDS[i % EDIT_KINDS.length])?.();
        expectSpareBitsClear(grid, "edited room");

        const {bytes, quadByteIndices} = encodeWithQuadByteIndices(grid);
        const reloaded = VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
        expect(reloaded.voxels.map((voxel: Voxel) => voxel.blockLayerMask))
            .toEqual(grid.voxels.map(voxel => voxel.blockLayerMask));
        expect(visibleQuads(reloaded)).toEqual(visibleQuads(grid));
        for (const quadIndex of visibleQuads(grid))
            expect(reloaded.quadsMem.quads[quadIndex]).toBe(grid.quadsMem.quads[quadIndex]);
        expectSpareBitsClear(reloaded, "reloaded room");

        // Set on every quad byte of what is read, it reaches none of the room's quads.
        for (const byteIndex of quadByteIndices)
            bytes[byteIndex] |= SPARE_QUAD_BIT;
        const fromMarked = VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
        expect(fromMarked.quadsMem.quads.every((quadByte, quadIndex) => quadByte == reloaded.quadsMem.quads[quadIndex]))
            .toBe(true);
    });
});
