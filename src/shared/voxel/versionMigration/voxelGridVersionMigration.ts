import BufferState from "../../networking/types/bufferState";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/sharedConstants";
import RestrictedZone from "../types/restrictedZone";
import Voxel from "../types/voxel";
// Type-only: VoxelGrid imports this module, so a value import would be an import cycle.
import type VoxelGrid from "../types/voxelGrid";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import LegacyVoxelGrid from "./legacyVoxelGrid";

// Layer count of the half-height format. Its layers map onto the current lowest ones; the upper half
// arrives empty.
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

// The entrance doorway of the oldest rooms: a cell of the boundary wall, open so many layers up.
const LEGACY_ENTRANCE_ROW = 31;
const LEGACY_ENTRANCE_COL = 16;
const LEGACY_ENTRANCE_HEIGHT_IN_LAYERS = 5;

// The bit of a quad that said whether it was drawn, while that was stored, and on a block's four side
// quads in version 6 that one of the block's sub-blocks was cut away.
const LEGACY_QUAD_SPARE_BIT = 0b10000000;

// Where a block's four side quads begin among its six: [-y, +y, -x, +x, -z, +z].
const FIRST_SIDE_QUAD_OFFSET = 2;

// Index N reads version N's layout into an empty legacy grid, as far as the last version it held.
const decoders: ((bufferState: BufferState, grid: LegacyVoxelGrid) => void)[] = [
    decodeHalfHeightFormat, // version 0 (same binary layout as version 1)
    decodeHalfHeightFormat, // version 1
    decodeCellsOnlyFormat, // version 2
    decodeCellsOnlyFormat, // version 3 (same binary layout as version 2)
    decodeCellsAndZonesFormat, // version 4
    decodeCellsAndZonesFormat, // version 5 (same binary layout as version 4)
    decodeShapedBlocksFormat, // version 6
];

// Index N converts version N to N+1, in place.
const converters: ((grid: LegacyVoxelGrid) => void)[] = [
    (grid: LegacyVoxelGrid) => { // version 0 -> 1
        const quadTextureIndices = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);

        // Corner walls, at the legacy room height (the next conversion raises the room).
        addLegacyCornerWall(grid, 0, 0, quadTextureIndices);
        addLegacyCornerWall(grid, 0, LegacyVoxelGrid.numCols-1, quadTextureIndices);
        addLegacyCornerWall(grid, LegacyVoxelGrid.numRows-1, 0, quadTextureIndices);
        addLegacyCornerWall(grid, LegacyVoxelGrid.numRows-1, LegacyVoxelGrid.numCols-1, quadTextureIndices);

        // Hollow the legacy entrance doorway so arriving players don't spawn inside the wall.
        forEachEntranceDoorwayLayer(collisionLayer => {
            grid.blockShapes[grid.getBlockIndex(LEGACY_ENTRANCE_ROW, LEGACY_ENTRANCE_COL, collisionLayer)] = 0;
        });
    },
    (grid: LegacyVoxelGrid) => { // version 1 -> 2
        // The room height doubled: existing contents stay in place (same floor, same layer height);
        // only the cap overhead changes.
        for (let row = 0; row < LegacyVoxelGrid.numRows; ++row)
        {
            for (let col = 0; col < LegacyVoxelGrid.numCols; ++col)
            {
                const ceilingTextureIndex = grid.quads[grid.getCeilingQuadIndex(row, col)] & 0b01111111;

                // The old flat ceiling becomes a real slab at the height it used to hang, textured with the
                // old ceiling texture, so the room below looks unchanged. The height is taken from the old
                // format, not from today's storey floor, so the migration can't drift if that changes.
                grid.addWholeBlock(row, col, LEGACY_NUM_COLLISION_LAYERS,
                    new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(ceilingTextureIndex));
            }
        }
    },
    (grid: LegacyVoxelGrid) => { // version 2 -> 3
        // Fill the old entrance doorway back in (doors are wall attachments and need the wall), using
        // the neighbouring wall's textures. Reverses the v0 -> v1 hole.
        forEachEntranceDoorwayLayer(collisionLayer => {
            grid.addWholeBlock(LEGACY_ENTRANCE_ROW, LEGACY_ENTRANCE_COL, collisionLayer,
                getNeighbouringWallTextureIndices(grid, LEGACY_ENTRANCE_ROW, LEGACY_ENTRANCE_COL, collisionLayer));
        });
    },
    () => { // version 3 -> 4
        // Restricted zones added; older rooms get none.
    },
    () => { // version 4 -> 5
        // Whether a quad is drawn stopped being stored (see VoxelQueryUtil.isVoxelQuadVisible), which left
        // its bit unused. Nothing here reads it, and it is dropped as the room is written out (see
        // convertToCubes).
    },
    () => { // version 5 -> 6
        // Blocks gained shapes, stored in the bit version 5 left unused. Older rooms hold whole blocks
        // only, as their readers leave them.
    },
];

const VoxelGridVersionMigration =
{
    // Fills an empty grid from bytes laid out as an older version: read as that version wrote them, then
    // converted forward one version at a time (see @docs/geometry/voxel_grid.md).
    decode: (bufferState: BufferState, voxelGrid: VoxelGrid, version: number): void =>
    {
        const legacyGrid = new LegacyVoxelGrid();
        decoders[version](bufferState, legacyGrid);
        for (let fromVersion = version; fromVersion < converters.length; ++fromVersion)
            converters[fromVersion](legacyGrid);
        convertToCubes(legacyGrid, voxelGrid);
    },
}

// Version 6 -> 7: voxels became half as wide, so that every block is a cube, and blocks lost their shapes.
// Each sub-block a block filled becomes a block of its own with that block's textures, and the four
// voxels a cell becomes each take its floor and ceiling quads. A quad keeps its texture index alone: the
// spare bit older versions put to their uses is dropped here. A zone covers the voxels its cells became.
function convertToCubes(legacyGrid: LegacyVoxelGrid, voxelGrid: VoxelGrid): void
{
    const quads = voxelGrid.quadsMem.quads;
    for (let legacyRow = 0; legacyRow < LegacyVoxelGrid.numRows; ++legacyRow)
    {
        for (let legacyCol = 0; legacyCol < LegacyVoxelGrid.numCols; ++legacyCol)
        {
            for (let subBlock = 0; subBlock < 4; ++subBlock)
            {
                const row = 2 * legacyRow + (subBlock >> 1);
                const col = 2 * legacyCol + (subBlock & 1);
                quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col)] =
                    legacyGrid.quads[legacyGrid.getCeilingQuadIndex(legacyRow, legacyCol)] & 0b01111111;
                quads[VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)] =
                    legacyGrid.quads[legacyGrid.getFloorQuadIndex(legacyRow, legacyCol)] & 0b01111111;

                let blockLayerMask = 0;
                for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
                {
                    const shape = legacyGrid.blockShapes[legacyGrid.getBlockIndex(legacyRow, legacyCol, collisionLayer)];
                    if ((shape & (1 << subBlock)) == 0)
                        continue;
                    blockLayerMask |= (1 << collisionLayer);

                    const legacyFirstQuadIndex = legacyGrid.getFirstQuadIndexInLayer(legacyRow, legacyCol, collisionLayer);
                    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
                    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                        quads[firstQuadIndex + i] = legacyGrid.quads[legacyFirstQuadIndex + i] & 0b01111111;
                }
                voxelGrid.voxels[row * NUM_VOXEL_COLS + col] = new Voxel(voxelGrid.quadsMem, row, col, blockLayerMask);
            }
        }
    }
    voxelGrid.restrictedZones = legacyGrid.restrictedZones.map(zone => new RestrictedZone(
        2 * zone.rowMin, 2 * zone.rowMax + 1, 2 * zone.colMin, 2 * zone.colMax + 1));
}

function forEachEntranceDoorwayLayer(visit: (collisionLayer: number) => void): void
{
    for (let i = 0; i < LEGACY_ENTRANCE_HEIGHT_IN_LAYERS; ++i)
        visit(COLLISION_LAYER_MIN + i);
}

// Texture indices of the wall beside the given cell (falls back to the first texture).
function getNeighbouringWallTextureIndices(grid: LegacyVoxelGrid, row: number, col: number,
    collisionLayer: number): number[]
{
    // The entrance is on an edge row, so its wall neighbours are the cells to either side in that row.
    for (const neighbourCol of [col - 1, col + 1])
    {
        if (neighbourCol < 0 || neighbourCol >= LegacyVoxelGrid.numCols ||
            grid.blockShapes[grid.getBlockIndex(row, neighbourCol, collisionLayer)] == 0)
        {
            continue;
        }
        const textureIndices = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        const startIndex = grid.getFirstQuadIndexInLayer(row, neighbourCol, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            textureIndices[i] = grid.quads[startIndex + i] & 0b01111111;
        return textureIndices;
    }
    return new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);
}

function addLegacyCornerWall(grid: LegacyVoxelGrid, row: number, col: number, quadTextureIndices: number[]): void
{
    for (let collisionLayer = 0; collisionLayer <= LEGACY_COLLISION_LAYER_MAX; ++collisionLayer)
        grid.addWholeBlock(row, col, collisionLayer, quadTextureIndices);
}

// One mask byte and 8 layers per cell, with an empty upper half.
function decodeHalfHeightFormat(bufferState: BufferState, grid: LegacyVoxelGrid): void
{
    decodeCells(bufferState, grid, 1, false);
}

// Full-height cells, with no restricted zones after them.
function decodeCellsOnlyFormat(bufferState: BufferState, grid: LegacyVoxelGrid): void
{
    decodeCells(bufferState, grid, 2, false);
}

// Full-height cells, then the restricted zones.
function decodeCellsAndZonesFormat(bufferState: BufferState, grid: LegacyVoxelGrid): void
{
    decodeCells(bufferState, grid, 2, false);
    decodeRestrictedZones(bufferState, grid);
}

// The same layout, with each block's shape in the spare bits of its side quads.
function decodeShapedBlocksFormat(bufferState: BufferState, grid: LegacyVoxelGrid): void
{
    decodeCells(bufferState, grid, 2, true);
    decodeRestrictedZones(bufferState, grid);
}

// A cell as every version up to 6 wrote it: its ceiling and floor quads, a mask of the layers holding a
// block (lowest byte and layer first), then the six quads of each of those layers. Layers the mask
// leaves out stay empty (freshly allocated memory).
function decodeCells(bufferState: BufferState, grid: LegacyVoxelGrid, numMaskBytes: number,
    blocksHaveShapes: boolean): void
{
    for (let row = 0; row < LegacyVoxelGrid.numRows; ++row)
    {
        for (let col = 0; col < LegacyVoxelGrid.numCols; ++col)
        {
            grid.quads[grid.getCeilingQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];
            grid.quads[grid.getFloorQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];

            let collisionLayerMask = 0;
            for (let i = 0; i < numMaskBytes; ++i)
                collisionLayerMask |= bufferState.view[bufferState.byteIndex++] << (8 * i);

            for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
            {
                if (((1 << collisionLayer) & collisionLayerMask) == 0)
                    continue;
                const firstQuadIndex = grid.getFirstQuadIndexInLayer(row, col, collisionLayer);
                for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                    grid.quads[firstQuadIndex + i] = bufferState.view[bufferState.byteIndex++];

                grid.blockShapes[grid.getBlockIndex(row, col, collisionLayer)] = blocksHaveShapes
                    ? getStoredShape(grid.quads, firstQuadIndex) : LegacyVoxelGrid.wholeBlockShape;
            }
        }
    }
}

// A version-6 block's shape, as its six quads spell it: the spare bit of each side quad said that one
// sub-block was cut away, in the order of a shape's bits. Whatever the bits spell is taken as it stands,
// since any sub-blocks make up a room of cubes.
function getStoredShape(quads: Uint8Array, firstQuadIndex: number): number
{
    let shape = LegacyVoxelGrid.wholeBlockShape;
    for (let subBlock = 0; subBlock < 4; ++subBlock)
    {
        if ((quads[firstQuadIndex + FIRST_SIDE_QUAD_OFFSET + subBlock] & LEGACY_QUAD_SPARE_BIT) != 0)
            shape &= ~(1 << subBlock);
    }
    return shape;
}

function decodeRestrictedZones(bufferState: BufferState, grid: LegacyVoxelGrid): void
{
    const numZones = bufferState.view[bufferState.byteIndex++];
    if (numZones > MAX_RESTRICTED_ZONES)
        throw new Error(`Decoded restricted zone count is out of range (numZones = ${numZones})`);
    for (let i = 0; i < numZones; ++i)
        grid.restrictedZones.push(RestrictedZone.decode(bufferState) as RestrictedZone);
}

export default VoxelGridVersionMigration;
