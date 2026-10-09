/**
 * Voxel grid version migration. Content blobs aren't rewritten in storage; the decoder reads each
 * version's format and steps it forward on every load. Fixtures were written by the previous commit's
 * encoder (see the fixtures' README), not a reimplementation.
 * - v1 -> v2 (height doubled): existing faces stay put, the old ceiling becomes a floor slab at the same
 *   height, and the new upper storey is empty.
 * - v2 -> v3 (doors hang on walls): the doorway cell is filled and finished like the wall; nothing else
 *   changes (reopening the doorway yields v2 byte for byte).
 * - v4 -> v5 (whether a quad is drawn is no longer stored): the bit that said so is cleared, and the room's
 *   blocks show the faces it drew, bar an outer shell that an older build left drawn.
 * - v5 -> v6 (blocks have shapes): nothing is rewritten. The spare bit spells a block's shape, and clear,
 *   as every older room has it, spells a whole block.
 * - v6 -> v7 (voxels half as wide, every block a cube): each cell becomes four voxels, and each half-cell
 *   sub-block a block filled becomes a block of its own with that block's textures.
 *
 * Fixtures up to version 5 describe their rooms cell by cell, each a world unit wide, so a room read today
 * is compared against them as read back at that resolution (see readAtLegacyResolution). They record quads
 * as their own versions stored them, with the bit that said a quad was drawn, which is put back from what
 * the room's blocks show.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import BufferState from "../../../src/shared/networking/types/bufferState";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN,
    MAX_ENCODED_VOXEL_GRID_BYTES, MAX_RESTRICTED_ZONES, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_VOXEL,
    NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/legacyVoxelGrids");
const FIXTURE_NAMES = ["bare", "procedural_1", "procedural_7", "procedural_12345",
    "procedural_999999", "mixed"];

// Legacy room height, and where migration lays the slab (not today's storey floor height).
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

// The grid every version up to 6 held: cells one world unit wide, each of which is four voxels now.
const LEGACY_NUM_ROWS = 32;
const LEGACY_NUM_COLS = 32;

// The entrance doorway of the oldest rooms, as they stored it: a cell of the boundary wall, open so many layers
// up. Today it is the voxels that cell became, two rows of two.
const LEGACY_ENTRANCE_ROW = 31;
const LEGACY_ENTRANCE_COL = 16;
const LEGACY_ENTRANCE_HEIGHT_IN_LAYERS = 5;
const DOORWAY_VOXELS = [0, 1].flatMap(rowOffset => [0, 1].map(colOffset => (
    {row: 2 * LEGACY_ENTRANCE_ROW + rowOffset, col: 2 * LEGACY_ENTRANCE_COL + colOffset})));
const LEGACY_NUM_QUADS = LEGACY_NUM_ROWS * LEGACY_NUM_COLS * NUM_VOXEL_QUADS_PER_VOXEL;

// A block's quads within its layer: [-y, +y, -x, +x, -z, +z].
const PLUS_X_QUAD_OFFSET = 3;
const PLUS_Z_QUAD_OFFSET = 5;

interface LegacyRoomDescription
{
    masks: number[];
    ceilingQuads: number[];
    floorQuads: number[];
    numVisibleQuads: number;
    layerQuadsHash: number;
}

function loadFixture(name: string): {bytes: Uint8Array, expected: LegacyRoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

function decode(bytes: Uint8Array): VoxelGrid
{
    return VoxelGrid.decode(new BufferState(bytes)) as VoxelGrid;
}

function encode(grid: VoxelGrid): Uint8Array
{
    const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
    grid.encode(out);
    return out.view.slice(0, out.byteIndex);
}

// The migrated room with its doorway reopened (v2's state), so preservation checks run against the
// recorded fixtures; a fill touching anything else wouldn't undo cleanly.
function decodeWithDoorwayReopened(bytes: Uint8Array): VoxelGrid
{
    const grid = decode(bytes);
    for (const {row, col} of DOORWAY_VOXELS)
    {
        for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + LEGACY_ENTRANCE_HEIGHT_IN_LAYERS; ++layer)
        {
            const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
            VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels, first);

            // Removal hides faces but keeps their paint; a v2 doorway is unpainted, so clear it too.
            for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                grid.quadsMem.quads[first + i] = 0;
        }
    }
    return grid;
}

// The bit of a quad that said whether it was drawn, in the formats up to version 4.
const LEGACY_QUAD_VISIBLE_BIT = 0b10000000;

function quadTextureIndex(quad: number): number
{
    return quad & 0b01111111;
}

// Whether a quad a fixture recorded was drawn.
function quadIsVisible(quad: number): boolean
{
    return (quad & LEGACY_QUAD_VISIBLE_BIT) != 0;
}

function getVoxel(grid: VoxelGrid, row: number, col: number): Voxel
{
    return grid.voxels[row * NUM_VOXEL_COLS + col];
}

// The four voxels a legacy cell became, in the order of a shape's bits (x half + 2 * z half).
function voxelsOfLegacyCell(grid: VoxelGrid, legacyRow: number, legacyCol: number): Voxel[]
{
    return [0, 1, 2, 3].map(subBlock => getVoxel(grid, 2 * legacyRow + (subBlock >> 1), 2 * legacyCol + (subBlock & 1)));
}

// A room read back cell by cell as the versions up to 5 held it, where every block filled its cell layer.
// masks: each cell's layers holding a block. quads: each legacy quad's texture index, in legacy index order.
// visible: whether that quad is drawn, as the room's blocks decide it.
interface LegacyView
{
    masks: number[];
    quads: Uint8Array;
    visible: boolean[];
}

// A cell's face is read off the voxel of the four that lies on the side it is turned to, where the face is
// the room's surface if it is drawn at all (the four agree on everything else; see the tests that say so).
function readAtLegacyResolution(grid: VoxelGrid): LegacyView
{
    const view: LegacyView = {masks: [], quads: new Uint8Array(LEGACY_NUM_QUADS), visible: new Array(LEGACY_NUM_QUADS)};
    for (let legacyRow = 0; legacyRow < LEGACY_NUM_ROWS; ++legacyRow)
    {
        for (let legacyCol = 0; legacyCol < LEGACY_NUM_COLS; ++legacyCol)
        {
            const voxels = voxelsOfLegacyCell(grid, legacyRow, legacyCol);
            view.masks.push(voxels[0].blockLayerMask);

            const firstLegacyQuadIndex = (legacyRow * LEGACY_NUM_COLS + legacyCol) * NUM_VOXEL_QUADS_PER_VOXEL;
            for (let offset = 0; offset < NUM_VOXEL_QUADS_PER_VOXEL; ++offset)
            {
                const faceOffset = offset % NUM_VOXEL_QUADS_PER_COLLISION_LAYER;
                const voxel = voxels[(faceOffset == PLUS_X_QUAD_OFFSET) ? 1 : (faceOffset == PLUS_Z_QUAD_OFFSET) ? 2 : 0];
                const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(voxel.row, voxel.col) + offset;
                view.quads[firstLegacyQuadIndex + offset] = grid.quadsMem.quads[quadIndex];
                view.visible[firstLegacyQuadIndex + offset] = VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex);
            }
        }
    }
    return view;
}

// A legacy quad as the formats up to version 4 stored it: its texture index under the bit that said it was
// drawn.
function legacyQuad(view: LegacyView, legacyQuadIndex: number): number
{
    return view.quads[legacyQuadIndex] | (view.visible[legacyQuadIndex] ? LEGACY_QUAD_VISIBLE_BIT : 0);
}

function legacyQuadIndexOf(legacyRow: number, legacyCol: number, layer: number, faceOffset: number): number
{
    return (legacyRow * LEGACY_NUM_COLS + legacyCol) * NUM_VOXEL_QUADS_PER_VOXEL +
        NUM_VOXEL_QUADS_PER_COLLISION_LAYER * layer + faceOffset;
}

// A cell's last two quads are the room's own ceiling and floor tiles over it.
function legacyCeilingQuadIndexOf(cellIndex: number): number
{
    return (cellIndex + 1) * NUM_VOXEL_QUADS_PER_VOXEL - 2;
}

function legacyFloorQuadIndexOf(cellIndex: number): number
{
    return (cellIndex + 1) * NUM_VOXEL_QUADS_PER_VOXEL - 1;
}

// The fixtures' hash over the legacy layers, which must survive migration byte for byte.
function hashLegacyLayerQuads(view: LegacyView): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let cellIndex = 0; cellIndex < LEGACY_NUM_ROWS * LEGACY_NUM_COLS; ++cellIndex)
    {
        for (let layer = COLLISION_LAYER_MIN; layer <= LEGACY_COLLISION_LAYER_MAX; ++layer)
        {
            const first = cellIndex * NUM_VOXEL_QUADS_PER_VOXEL + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * layer;
            for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            {
                hash ^= legacyQuad(view, first + i);
                hash = Math.imul(hash, 0x01000193) >>> 0;
            }
        }
    }
    return hash;
}

// What makes reading a room back cell by cell fair: the four voxels of every cell hold the same blocks,
// finished the same, under the same floor and ceiling tiles.
function expectEveryCellQuadrupled(grid: VoxelGrid): void
{
    const quads = grid.quadsMem.quads;
    let numCellsAtOdds = 0;
    for (let legacyRow = 0; legacyRow < LEGACY_NUM_ROWS; ++legacyRow)
    {
        for (let legacyCol = 0; legacyCol < LEGACY_NUM_COLS; ++legacyCol)
        {
            const [first, ...others] = voxelsOfLegacyCell(grid, legacyRow, legacyCol);
            const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(first.row, first.col);
            const alike = others.every(other =>
            {
                const otherQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(other.row, other.col);
                if (other.blockLayerMask != first.blockLayerMask)
                    return false;
                for (let offset = 0; offset < NUM_VOXEL_QUADS_PER_VOXEL; ++offset)
                {
                    if (quads[otherQuadIndex + offset] != quads[firstQuadIndex + offset])
                        return false;
                }
                return true;
            });
            if (!alike)
                ++numCellsAtOdds;
        }
    }
    expect(numCellsAtOdds).toBe(0);
}

function expectSameGrid(actual: VoxelGrid, expected: VoxelGrid): void
{
    expect(actual.quadsMem.quads.every((quad, i) => quad == expected.quadsMem.quads[i])).toBe(true);
    expect(actual.voxels.map(voxel => voxel.blockLayerMask)).toEqual(expected.voxels.map(voxel => voxel.blockLayerMask));
    expect(actual.restrictedZones).toEqual(expected.restrictedZones);
}

describe.each(FIXTURE_NAMES)("migrating a version-1 room (%s)", (name) => {
    const {bytes, expected} = loadFixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(1);

        // Re-encoding stamps the current version, so migration is a one-time cost per room.
        expect(encode(decode(bytes))[0]).toBe(VoxelGrid.latestFormatVersion);
    });

    it("makes four voxels of every cell, alike in their blocks and finishes", () => {
        expect(decode(bytes).voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        expectEveryCellQuadrupled(decode(bytes));
    });

    it("keeps every layer the room already had, face for face", () => {
        expect(hashLegacyLayerQuads(readAtLegacyResolution(decodeWithDoorwayReopened(bytes)))).toBe(expected.layerQuadsHash);
    });

    it("keeps every block standing where it stood, and adds the storey floor over it", () => {
        // The room's old contents, plus a slab at the height its ceiling used to hang at.
        expect(readAtLegacyResolution(decodeWithDoorwayReopened(bytes)).masks)
            .toEqual(expected.masks.map(mask => mask | (1 << LEGACY_NUM_COLLISION_LAYERS)));
    });

    it("fills the doorway in, and finishes it like the wall it is now part of", () => {
        const view = readAtLegacyResolution(decode(bytes));
        const doorwayCell = LEGACY_ENTRANCE_ROW * LEGACY_NUM_COLS + LEGACY_ENTRANCE_COL;
        const insideFace = VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("z", "-");

        for (let layer = COLLISION_LAYER_MIN;
            layer < COLLISION_LAYER_MIN + LEGACY_ENTRANCE_HEIGHT_IN_LAYERS; ++layer)
        {
            // Solid, so that a door has something to hang on...
            expect(view.masks[doorwayCell] & (1 << layer)).not.toBe(0);

            // ...and finished like its neighbour, so it reads as wall.
            expect(view.quads[legacyQuadIndexOf(LEGACY_ENTRANCE_ROW, LEGACY_ENTRANCE_COL, layer, insideFace)])
                .toBe(view.quads[legacyQuadIndexOf(LEGACY_ENTRANCE_ROW, LEGACY_ENTRANCE_COL - 1, layer, insideFace)]);
        }
    });

    it("leaves the storey above the slab empty", () => {
        const grid = decode(bytes);
        let numBlocks = 0, numPaintedQuads = 0;
        for (const voxel of grid.voxels)
        {
            for (let layer = LEGACY_NUM_COLLISION_LAYERS + 1; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                if (VoxelQueryUtil.isVoxelBlockPresent(voxel, layer))
                    ++numBlocks;

                const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer);
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                {
                    if (grid.quadsMem.quads[first + i] != 0)
                        ++numPaintedQuads;
                }
            }
        }
        expect(numBlocks).toBe(0);
        expect(numPaintedQuads).toBe(0);
    });

    it("leaves the room's floor exactly as it was", () => {
        const view = readAtLegacyResolution(decodeWithDoorwayReopened(bytes));
        expect(expected.floorQuads.map((_, cellIndex) => legacyQuad(view, legacyFloorQuadIndexOf(cellIndex))))
            .toEqual(expected.floorQuads);
    });

    it("shows the old ceiling from below, as the underside of the new storey floor", () => {
        const view = readAtLegacyResolution(decodeWithDoorwayReopened(bytes));
        const underside = VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "-");
        for (let cellIndex = 0; cellIndex < expected.ceilingQuads.length; ++cellIndex)
        {
            const slabQuadIndex = cellIndex * NUM_VOXEL_QUADS_PER_VOXEL +
                NUM_VOXEL_QUADS_PER_COLLISION_LAYER * LEGACY_NUM_COLLISION_LAYERS + underside;

            // It carries what the ceiling tile it replaces carried, visible exactly where the ceiling tile
            // was (every cell not walled to the top).
            expect(legacyQuad(view, slabQuadIndex), `cell ${cellIndex}`).toBe(expected.ceilingQuads[cellIndex]);
        }
    });

    it("hangs the room's own ceiling over the empty storey instead", () => {
        const view = readAtLegacyResolution(decode(bytes));
        for (let cellIndex = 0; cellIndex < expected.ceilingQuads.length; ++cellIndex)
        {
            // Nothing stands above it, so every cell is visible.
            expect(legacyQuad(view, legacyCeilingQuadIndexOf(cellIndex)), `cell ${cellIndex}`)
                .toBe(quadTextureIndex(expected.ceilingQuads[cellIndex]) | LEGACY_QUAD_VISIBLE_BIT);
        }
    });

    it("no longer holds which of its quads are drawn", () => {
        expect(decode(bytes).quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);
    });

    it("comes out of a second decode identical to the first", () => {
        // Migration depends only on the blob, so repeated loads agree.
        expectSameGrid(decode(bytes), decode(bytes));
    });

    it("survives a round trip through the current format unchanged", () => {
        // Re-reading a migrated room must give the same room, or it decays on each save.
        const migrated = decode(bytes);
        expectSameGrid(decode(encode(migrated)), migrated);
    });
});

describe("migrating a version-0 room", () => {
    // v0 shares v1's layout, so reading one exercises the whole conversion chain. A version-0 room had no
    // walls in its corners, so the fixture's are taken out of it first.
    const CORNERS = [[0, 0], [0, LEGACY_NUM_COLS - 1], [LEGACY_NUM_ROWS - 1, 0], [LEGACY_NUM_ROWS - 1, LEGACY_NUM_COLS - 1]];
    const version0Bytes = withCellsEmptied(loadFixture("bare").bytes, CORNERS);
    version0Bytes[0] = 0;

    // A half-height blob (see the fixtures' README) with the blocks of some of its cells left out: each cell
    // is its ceiling and floor quads, a one-byte mask of its layers, then six quads for each layer named.
    function withCellsEmptied(bytes: Uint8Array, cells: number[][]): Uint8Array
    {
        const out: number[] = [bytes[0]];
        let byteIndex = 1;
        for (let cellIndex = 0; cellIndex < LEGACY_NUM_ROWS * LEGACY_NUM_COLS; ++cellIndex)
        {
            const mask = bytes[byteIndex + 2];
            const numLayerBytes = NUM_VOXEL_QUADS_PER_COLLISION_LAYER * (mask.toString(2).split("1").length - 1);
            const emptied = cells.some(([row, col]) => row * LEGACY_NUM_COLS + col == cellIndex);
            out.push(bytes[byteIndex], bytes[byteIndex + 1], emptied ? 0 : mask);
            if (!emptied)
                out.push(...bytes.subarray(byteIndex + 3, byteIndex + 3 + numLayerBytes));
            byteIndex += 3 + numLayerBytes;
        }
        expect(byteIndex).toBe(bytes.length);
        return new Uint8Array(out);
    }

    it("is carried through every version up to the current one", () => {
        const grid = decode(version0Bytes);
        expect(grid.sourceFormatVersion).toBe(0);
        expectEveryCellQuadrupled(grid);
        const view = readAtLegacyResolution(grid);

        for (const mask of view.masks)
            expect(mask & (1 << LEGACY_NUM_COLLISION_LAYERS)).not.toBe(0);
    });

    it("is given the corner walls version 1 introduced, standing through its lower storey", () => {
        const view = readAtLegacyResolution(decode(version0Bytes));
        const lowerStorey = (1 << LEGACY_NUM_COLLISION_LAYERS) - 1;
        for (const [row, col] of CORNERS)
        {
            expect(view.masks[row * LEGACY_NUM_COLS + col] & lowerStorey, `corner ${row},${col}`).toBe(lowerStorey);
            // Finished in the first texture, as they were put up.
            for (let layer = COLLISION_LAYER_MIN; layer <= LEGACY_COLLISION_LAYER_MAX; ++layer)
            {
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    expect(view.quads[legacyQuadIndexOf(row, col, layer, i)]).toBe(0);
            }
        }
    });

    it("has no corner walls of its own to begin with, read as the version after it", () => {
        // (The control: stamped as version 1, the same bytes keep their corners open.)
        const version1Bytes = version0Bytes.slice();
        version1Bytes[0] = 1;
        const view = readAtLegacyResolution(decode(version1Bytes));
        const lowerStorey = (1 << LEGACY_NUM_COLLISION_LAYERS) - 1;
        for (const [row, col] of CORNERS)
            expect(view.masks[row * LEGACY_NUM_COLS + col] & lowerStorey, `corner ${row},${col}`).toBe(0);
    });
});

describe("the migrated room as a room", () => {
    it("holds no quad outside the grid's own range", () => {
        const grid = decode(loadFixture("procedural_12345").bytes);
        expect(grid.quadsMem.quads.length).toBe(NUM_VOXEL_QUADS_PER_ROOM);
    });

    it("seals the doorway, so that the room's door has a wall to hang on", () => {
        // An open doorway would reject the room's own door (see ObjectAttachmentUtil), so this is checked
        // after migration.
        const grid = decode(loadFixture("procedural_1").bytes);
        for (const {row, col} of DOORWAY_VOXELS)
            expect(VoxelQueryUtil.isVoxelBlockPresent(getVoxel(grid, row, col), COLLISION_LAYER_MIN)).toBe(true);
    });
});

// ─── Version 3 -> 4: restricted zones ───
// Zones are appended after the voxels, so every v3 voxel must read back unchanged (a byte of drift would
// still decode, just subtly wrong).

const V3_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV3");
const V3_FIXTURE_NAMES = ["solid", "hub", "regular", "mixed"];

interface Version3RoomDescription
{
    masks: number[];
    quadsHash: number;
    numVisibleQuads: number;
    byteLength: number;
}

function loadVersion3Fixture(name: string): {bytes: Uint8Array, expected: Version3RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V3_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V3_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

// The same fold the version-3 and version-4 fixtures were written with, over the whole of the room's quad
// memory as those versions held it.
function hashAllQuads(view: LegacyView): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < LEGACY_NUM_QUADS; ++i)
    {
        hash ^= legacyQuad(view, i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

function countVisibleQuads(view: LegacyView): number
{
    return view.visible.filter(visible => visible).length;
}

function zonesOf(grid: VoxelGrid): number[][]
{
    return grid.restrictedZones.map(zone => [zone.rowMin, zone.rowMax, zone.colMin, zone.colMax]);
}

// Zones as an older room wrote them, over cells a world unit wide, as they should come back: over the voxels
// those cells became.
function overVoxels(legacyZones: number[][]): number[][]
{
    return legacyZones.map(([rowMin, rowMax, colMin, colMax]) =>
        [2 * rowMin, 2 * rowMax + 1, 2 * colMin, 2 * colMax + 1]);
}

describe.each(V3_FIXTURE_NAMES)("migrating a version-3 room (%s)", (name) => {
    const {bytes, expected} = loadVersion3Fixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(3);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(3);
    });

    it("comes back with every cell exactly as it was written, as four voxels alike", () => {
        const grid = decode(bytes);
        expectEveryCellQuadrupled(grid);

        const view = readAtLegacyResolution(grid);
        expect(view.masks).toEqual(expected.masks);
        expect(hashAllQuads(view)).toBe(expected.quadsHash);
        expect(countVisibleQuads(view)).toBe(expected.numVisibleQuads);
        expect(grid.quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);
    });

    it("comes back holding no restricted zones", () => {
        // Pre-zone rooms have no zones, so they stay fully editable.
        expect(decode(bytes).restrictedZones).toEqual([]);
    });

    it("survives a round trip through the current format unchanged", () => {
        const migrated = decode(bytes);
        migrated.restrictedZones = [new RestrictedZone(2, 9, 3, 11), new RestrictedZone(20, 20, 0, NUM_VOXEL_COLS - 1)];

        const stored = encode(migrated);
        expect(stored[0]).toBe(VoxelGrid.latestFormatVersion);
        expectSameGrid(decode(stored), migrated);
    });
});

// ─── Version 4 -> 5: whether a quad is drawn is no longer stored ───
// The layout doesn't change, so a careless reader would still decode these. What must hold is that the
// room's blocks show the faces the old bit said were drawn (see VoxelQueryUtil.isVoxelQuadVisible).

const V4_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV4");
const V4_FIXTURE_NAMES = ["hub", "regular", "mixed", "shell"];

interface Version4RoomDescription
{
    masks: number[];
    quadsHash: number;
    quadsHashWithoutOuterShell: number;
    numVisibleQuads: number;
    numVisibleOuterShellQuads: number;
    restrictedZones: number[][];
    byteLength: number;
}

function loadVersion4Fixture(name: string): {bytes: Uint8Array, expected: Version4RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V4_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V4_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

describe.each(V4_FIXTURE_NAMES)("migrating a version-4 room (%s)", (name) => {
    const {bytes, expected} = loadVersion4Fixture(name);

    it("is recognised as an older version than the one being written now", () => {
        expect(bytes[0]).toBe(4);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(4);
    });

    it("comes back with every cell exactly as it was written, and every zone over the same ground", () => {
        const grid = decode(bytes);
        expectEveryCellQuadrupled(grid);
        expect(readAtLegacyResolution(grid).masks).toEqual(expected.masks);
        expect(zonesOf(grid)).toEqual(overVoxels(expected.restrictedZones));
    });

    it("shows the faces it was stored as drawing, each in its texture, without an outer shell", () => {
        const view = readAtLegacyResolution(decode(bytes));
        expect(hashAllQuads(view)).toBe(expected.quadsHashWithoutOuterShell);
        expect(countVisibleQuads(view)).toBe(expected.numVisibleQuads - expected.numVisibleOuterShellQuads);
    });

    it("leaves the bit that said so unused, and keeps it so through a save", () => {
        const migrated = decode(bytes);
        expect(migrated.quadsMem.quads.every(quad => quad < LEGACY_QUAD_VISIBLE_BIT)).toBe(true);

        const stored = encode(migrated);
        expect(stored[0]).toBe(VoxelGrid.latestFormatVersion);
        expectSameGrid(decode(stored), migrated);
    });
});

describe("an older room claiming more zones than a room may carry", () => {
    it("is refused, whichever version wrote it", () => {
        for (const {bytes, expected} of [loadVersion4Fixture("mixed"), loadVersion5Fixture("mixed"), loadVersion6Fixture("regular")])
        {
            // The zones are the last thing in the blob, after the byte that counts them.
            const countByteIndex = bytes.length - 1 - 4 * expected.restrictedZones.length;
            expect(bytes[countByteIndex]).toBe(expected.restrictedZones.length);

            const tampered = bytes.slice();
            tampered[countByteIndex] = MAX_RESTRICTED_ZONES + 1;
            expect(() => decode(tampered), `version ${bytes[0]}`).toThrow(/zone count is out of range/);
        }
    });
});

describe("a room saved while the outer shell was still drawn", () => {
    // The shell stopped being drawn without the rooms already saved being rewritten, so theirs stayed
    // stored as drawn. Nothing stores it now.
    const {bytes, expected} = loadVersion4Fixture("shell");

    it("is the fixture whose stored shell the others lack", () => {
        expect(expected.numVisibleOuterShellQuads).toBeGreaterThan(0);
        for (const other of V4_FIXTURE_NAMES.filter(name => name != "shell"))
            expect(loadVersion4Fixture(other).expected.numVisibleOuterShellQuads, other).toBe(0);
    });

    it("comes back with no face drawn on the outside of the grid", () => {
        const grid = decode(bytes);
        let numOutwardQuadsDrawn = 0;
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            const outwardQuadIndices: number[] = [];
            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(row, 0, "x", "-", layer));
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(row, NUM_VOXEL_COLS - 1, "x", "+", layer));
            }
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(0, col, "z", "-", layer));
                outwardQuadIndices.push(VoxelQueryUtil.getVoxelQuadIndex(NUM_VOXEL_ROWS - 1, col, "z", "+", layer));
            }
            numOutwardQuadsDrawn += outwardQuadIndices.filter(quadIndex =>
                VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex)).length;
        }
        expect(numOutwardQuadsDrawn).toBe(0);
    });
});

// ─── Version 5: the last format holding whole blocks only ───
// Its layout is version 6's, and its blocks are all whole, which version 6 wrote the same way. So one of
// these rooms must come back with every block it held as four cubes, and nothing shrunk or missing for a
// reader having mistaken the bit it left unused.

const V5_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV5");
const V5_FIXTURE_NAMES = ["hub", "regular", "mixed"];

interface Version5RoomDescription
{
    masks: number[];
    quadsHash: number;
    numVisibleQuads: number;
    restrictedZones: number[][];
    byteLength: number;
}

function loadVersion5Fixture(name: string): {bytes: Uint8Array, expected: Version5RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V5_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V5_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

// The fold the fixtures from version 5 on were written with: over a room's quad memory as it is, which by
// then held texture indices alone.
function hashQuadMemory(quads: Uint8Array): number
{
    let hash = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < quads.length; ++i)
    {
        hash ^= quads[i];
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

describe.each(V5_FIXTURE_NAMES)("migrating a version-5 room (%s)", (name) => {
    const {bytes, expected} = loadVersion5Fixture(name);

    it("is the room its fixture says it is", () => {
        expect(bytes[0]).toBe(5);
        expect(bytes.length).toBe(expected.byteLength);
        expect(decode(bytes).sourceFormatVersion).toBe(5);
    });

    it("comes back with every cell and quad exactly as it was written, as four voxels alike, and every zone over the same ground", () => {
        const grid = decode(bytes);
        expectEveryCellQuadrupled(grid);

        const view = readAtLegacyResolution(grid);
        expect(view.masks).toEqual(expected.masks);
        expect(hashQuadMemory(view.quads)).toBe(expected.quadsHash);
        expect(countVisibleQuads(view)).toBe(expected.numVisibleQuads);
        expect(zonesOf(grid)).toEqual(overVoxels(expected.restrictedZones));
    });

    it("survives a round trip through the current format unchanged", () => {
        const migrated = decode(bytes);
        const stored = encode(migrated);
        expect(stored[0]).toBe(VoxelGrid.latestFormatVersion);
        expectSameGrid(decode(stored), migrated);
    });
});

// ─── Version 6 -> 7: every block a cube ─────────────────────────────────────
// A version-6 block filled all of its cell layer, a half of it or a quarter. Each of the half-cell
// sub-blocks it filled is a voxel's block now, so the room keeps its form, and a block's shape is gone.

const V6_FIXTURE_DIR = path.join(__dirname, "../fixtures/voxelGridsV6");
const V6_FIXTURE_NAMES = ["shapes", "regular", "hub"];

interface Version6RoomDescription
{
    // One hex digit per block, in block index order over the legacy cells (see the fixtures' README).
    shapes: string;
    numBlocksByShape: {[shape: string]: number};
    quadsHash: number;
    restrictedZones: number[][];
    byteLength: number;
}

function loadVersion6Fixture(name: string): {bytes: Uint8Array, expected: Version6RoomDescription}
{
    return {
        bytes: new Uint8Array(fs.readFileSync(path.join(V6_FIXTURE_DIR, `${name}.bin`))),
        expected: JSON.parse(fs.readFileSync(path.join(V6_FIXTURE_DIR, `${name}.json`), "utf8")),
    };
}

function shapeOf(expected: Version6RoomDescription, legacyRow: number, legacyCol: number, layer: number): number
{
    return parseInt(expected.shapes[(legacyRow * LEGACY_NUM_COLS + legacyCol) * NUM_COLLISION_LAYERS + layer], 16);
}

describe.each(V6_FIXTURE_NAMES)("migrating a version-6 room (%s)", (name) => {
    const {bytes, expected} = loadVersion6Fixture(name);

    it("is the room its fixture says it is", () => {
        expect(bytes[0]).toBe(6);
        expect(bytes.length).toBe(expected.byteLength);
        expect(expected.shapes.length).toBe(LEGACY_NUM_ROWS * LEGACY_NUM_COLS * NUM_COLLISION_LAYERS);
        expect(decode(bytes).sourceFormatVersion).toBe(6);
    });

    it("stands a cube wherever a block filled a sub-block, and nowhere else", () => {
        const grid = decode(bytes);
        expect(grid.voxels.length).toBe(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);

        let numCubes = 0, numCubesAtOdds = 0;
        for (let legacyRow = 0; legacyRow < LEGACY_NUM_ROWS; ++legacyRow)
        {
            for (let legacyCol = 0; legacyCol < LEGACY_NUM_COLS; ++legacyCol)
            {
                const voxels = voxelsOfLegacyCell(grid, legacyRow, legacyCol);
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    const shape = shapeOf(expected, legacyRow, legacyCol, layer);
                    for (let subBlock = 0; subBlock < 4; ++subBlock)
                    {
                        const filled = (shape & (1 << subBlock)) != 0;
                        if (filled)
                            ++numCubes;
                        if (VoxelQueryUtil.isVoxelBlockPresent(voxels[subBlock], layer) != filled)
                            ++numCubesAtOdds;
                    }
                }
            }
        }
        expect(numCubesAtOdds).toBe(0);

        // Four cubes for a whole block, two for a half, one for a quarter.
        const numSubBlocksOf = (shape: number) => [0, 1, 2, 3].filter(subBlock => shape & (1 << subBlock)).length;
        expect(numCubes).toBe(Object.entries(expected.numBlocksByShape)
            .reduce((sum, [shape, numBlocks]) => sum + numSubBlocksOf(Number(shape)) * numBlocks, 0));
    });

    it("finishes every cube as the block it was part of, and leaves empty space unpainted", () => {
        const grid = decode(bytes);
        const quads = grid.quadsMem.quads;

        // The room's quad memory as version 6 held it, put back together from the cubes: a block's six
        // quads from any cube of it, since all of them must carry the same.
        const legacyQuads = new Uint8Array(LEGACY_NUM_QUADS);
        let numCubesAtOdds = 0;
        for (let legacyRow = 0; legacyRow < LEGACY_NUM_ROWS; ++legacyRow)
        {
            for (let legacyCol = 0; legacyCol < LEGACY_NUM_COLS; ++legacyCol)
            {
                const voxels = voxelsOfLegacyCell(grid, legacyRow, legacyCol);
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    const shape = shapeOf(expected, legacyRow, legacyCol, layer);
                    const firstCube = voxels.find((_, subBlock) => (shape & (1 << subBlock)) != 0);
                    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    {
                        const quadOf = (voxel: Voxel) =>
                            quads[VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, layer) + i];
                        const blockQuad = (firstCube != undefined) ? quadOf(firstCube) : 0;
                        legacyQuads[legacyQuadIndexOf(legacyRow, legacyCol, layer, i)] = blockQuad;

                        voxels.forEach((voxel, subBlock) => {
                            if (quadOf(voxel) != ((shape & (1 << subBlock)) ? blockQuad : 0))
                                ++numCubesAtOdds;
                        });
                    }
                }

                // The room's own ceiling and floor tiles over the cell, which all four voxels take.
                const cellIndex = legacyRow * LEGACY_NUM_COLS + legacyCol;
                for (const [legacyQuadIndex, quadIndexOf] of [
                    [legacyCeilingQuadIndexOf(cellIndex), VoxelQueryUtil.getCeilingVoxelQuadIndex],
                    [legacyFloorQuadIndexOf(cellIndex), VoxelQueryUtil.getFloorVoxelQuadIndex]] as const)
                {
                    legacyQuads[legacyQuadIndex] = quads[quadIndexOf(voxels[0].row, voxels[0].col)];
                    if (voxels.some(voxel => quads[quadIndexOf(voxel.row, voxel.col)] != legacyQuads[legacyQuadIndex]))
                        ++numCubesAtOdds;
                }
            }
        }
        expect(numCubesAtOdds).toBe(0);
        expect(hashQuadMemory(legacyQuads)).toBe(expected.quadsHash);
    });

    it("keeps its zones over the same ground", () => {
        expect(zonesOf(decode(bytes))).toEqual(overVoxels(expected.restrictedZones));
    });

    it("leaves the bits that spelt its blocks' shapes unused, and keeps them so through a save", () => {
        const migrated = decode(bytes);
        expect(migrated.quadsMem.quads.every(quad => (quad & 0b10000000) == 0)).toBe(true);

        const stored = encode(migrated);
        expect(stored[0]).toBe(VoxelGrid.latestFormatVersion);
        expectSameGrid(decode(stored), migrated);
    });

    it("comes out of a second decode identical to the first", () => {
        expectSameGrid(decode(bytes), decode(bytes));
    });
});

describe("a version-6 room of whole blocks", () => {
    it("comes back as the same room read from version 5 would", () => {
        // The hub fixture holds no shrunk block, so each of its cells is four voxels alike.
        const {bytes, expected} = loadVersion6Fixture("hub");
        expect(Object.keys(expected.numBlocksByShape).sort()).toEqual(["0", "15"]);
        expectEveryCellQuadrupled(decode(bytes));
    });
});

describe("a version-6 room whose stored bits spell no shape a block could have", () => {
    // Version 6's own reader refused such a room. Any sub-blocks make up a room of cubes, so they are
    // taken as they stand.
    const {bytes, expected} = loadVersion6Fixture("shapes");

    // Where a stored block's six quad bytes start, found by walking the layout itself.
    function storedBlockByteIndex(legacyRow: number, legacyCol: number, layer: number): number
    {
        const countBits = (mask: number) => mask.toString(2).split("1").length - 1;
        let byteIndex = 1; // past the version
        for (let cellIndex = 0; cellIndex < legacyRow * LEGACY_NUM_COLS + legacyCol; ++cellIndex)
        {
            const mask = bytes[byteIndex + 2] | (bytes[byteIndex + 3] << 8);
            byteIndex += 4 + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * countBits(mask);
        }
        const mask = bytes[byteIndex + 2] | (bytes[byteIndex + 3] << 8);
        expect(mask & (1 << layer), "the block is stored").not.toBe(0);
        return byteIndex + 4 + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * countBits(mask & ((1 << layer) - 1));
    }

    // A whole block standing free in the hall (see the fixtures' README).
    const ROW = 6, COL = 5, LAYER = 5;

    function cubesAfterCuttingAway(...subBlocks: number[]): boolean[]
    {
        const tampered = bytes.slice();
        const first = storedBlockByteIndex(ROW, COL, LAYER);
        for (const subBlock of subBlocks)
            tampered[first + 2 + subBlock] |= 0b10000000;
        return voxelsOfLegacyCell(decode(tampered), ROW, COL).map(voxel => VoxelQueryUtil.isVoxelBlockPresent(voxel, LAYER));
    }

    it("stands on a whole block to begin with", () => {
        expect(shapeOf(expected, ROW, COL, LAYER)).toBe(0b1111);
        expect(cubesAfterCuttingAway()).toEqual([true, true, true, true]);
    });

    it("reads each side quad's spare bit as its own sub-block cut away, whatever that leaves", () => {
        // Two left that only touch at a corner, three left in an L, and none left at all.
        expect(cubesAfterCuttingAway(0, 3)).toEqual([false, true, true, false]);
        expect(cubesAfterCuttingAway(1, 2)).toEqual([true, false, false, true]);
        expect(cubesAfterCuttingAway(2)).toEqual([true, true, false, true]);
        expect(cubesAfterCuttingAway(0, 1, 2, 3)).toEqual([false, false, false, false]);
    });

    it("drops the spare bits of the bottom and top quads, which were never part of a shape", () => {
        const strayBits = bytes.slice();
        const first = storedBlockByteIndex(ROW, COL, LAYER);
        strayBits[first] |= 0b10000000;
        strayBits[first + 1] |= 0b10000000;
        expectSameGrid(decode(strayBits), decode(bytes));
    });
});

describe("the current format", () => {
    it("stores a room in a version of its own, read back as it was written", () => {
        const grid = decode(loadVersion6Fixture("regular").bytes);
        const stored = encode(grid);
        const reloaded = decode(stored);
        expect(reloaded.sourceFormatVersion).toBe(VoxelGrid.latestFormatVersion);
        expectSameGrid(reloaded, grid);
        // Written again, it is the same bytes.
        expect(Array.from(encode(reloaded))).toEqual(Array.from(stored));
    });

    it("drops the spare bit of any quad it reads", () => {
        const stored = encode(decode(loadVersion6Fixture("shapes").bytes));
        const tampered = stored.slice();
        // Every quad byte of the first voxel: its two tiles, then (past its mask) its blocks' quads.
        const mask = tampered[3] | (tampered[4] << 8);
        const numBlocks = mask.toString(2).split("1").length - 1;
        expect(numBlocks).toBeGreaterThan(0);
        for (const byteIndex of [1, 2, ...Array.from({length: NUM_VOXEL_QUADS_PER_COLLISION_LAYER * numBlocks}, (_, i) => 5 + i)])
            tampered[byteIndex] |= 0b10000000;
        expectSameGrid(decode(tampered), decode(stored));
    });
});

describe("the encoded room's size bound", () => {
    it("holds for the largest room there is, with every zone it may carry", () => {
        // The encode buffer is sized from this bound, so exceeding it would write past the buffer.
        const grid = VoxelGrid.createBaseGrid(); // solid floor to ceiling: the costliest room to write
        for (let i = 0; i < MAX_RESTRICTED_ZONES; ++i)
            grid.restrictedZones.push(new RestrictedZone(i, i, 0, NUM_VOXEL_COLS - 1));

        const out = new BufferState(new Uint8Array(MAX_ENCODED_VOXEL_GRID_BYTES));
        grid.encode(out);
        expect(out.byteIndex).toBe(MAX_ENCODED_VOXEL_GRID_BYTES);
    });
});
