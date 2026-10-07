import BufferState from "../../networking/types/bufferState";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../system/sharedConstants";
import RestrictedZone from "../types/restrictedZone";
import Voxel from "../types/voxel";
// Type-only: VoxelGrid imports this module, so a value import would be an import cycle.
import type VoxelGrid from "../types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../types/voxelQuadsRuntimeMemory";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import VoxelUpdateUtil from "../util/voxelUpdateUtil";
import { RoomVolumeConstructorMap } from "../../room/generation/maps/roomVolumeConstructorMap";

// Layer count of the half-height format. Its layers map onto the current lowest ones; the upper half
// arrives empty.
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

// The bit of a quad that said whether it was drawn, while that was stored.
const LEGACY_QUAD_VISIBLE_BIT = 0b10000000;

// Index N reads version N's layout into an empty grid.
const decoders: ((bufferState: BufferState, voxelGrid: VoxelGrid) => void)[] = [
    decodeHalfHeightFormat, // version 0 (same binary layout as version 1)
    decodeHalfHeightFormat, // version 1
    decodeVoxelsOnlyFormat, // version 2
    decodeVoxelsOnlyFormat, // version 3 (same binary layout as version 2)
    decodeVoxelsAndZonesFormat, // version 4
    decodeVoxelsAndZonesFormat, // version 5 (same binary layout as version 4)
];

// Index N converts version N to N+1, in place.
const converters: ((voxelGrid: VoxelGrid) => void)[] = [
    (voxelGrid: VoxelGrid) => { // version 0 -> 1
        const voxels = voxelGrid.voxels;
        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);

        // Corner walls, at the legacy room height (the next conversion raises the room).
        addLegacyCornerWall(voxels, 0, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, 0, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);

        // Hollow the legacy entrance doorway so arriving players don't spawn inside the wall.
        const entrance = RoomVolumeConstructorMap["InitialMultiplayerEntrance"]();
        for (let row = entrance.rowMin; row <= entrance.rowMax; ++row)
        {
            for (let col = entrance.colMin; col <= entrance.colMax; ++col)
            {
                for (let collisionLayer = entrance.collisionLayerMin; collisionLayer <= entrance.collisionLayerMax; ++collisionLayer)
                {
                    VoxelUpdateUtil.removeVoxelBlock(undefined, voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer));
                }
            }
        }
    },
    (voxelGrid: VoxelGrid) => { // version 1 -> 2
        // The room height doubled: existing contents stay in place (same floor, same layer height);
        // only the cap overhead changes.
        const quads = voxelGrid.quadsMem.quads;

        for (const voxel of voxelGrid.voxels)
        {
            const ceilingTextureIndex =
                quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col)] & 0b01111111;

            // The old flat ceiling becomes a real slab at the height it used to hang, textured with the
            // old ceiling texture, so the room below looks unchanged. The height is taken from the old
            // format, not from today's storey floor, so the migration can't drift if that changes.
            VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col,
                    LEGACY_NUM_COLLISION_LAYERS),
                new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(ceilingTextureIndex));
        }
    },
    (voxelGrid: VoxelGrid) => { // version 2 -> 3
        // Fill the old entrance doorway back in (doors are wall attachments and need the wall), using
        // the neighbouring wall's textures. Reverses the v0 -> v1 hole.
        const entrance = RoomVolumeConstructorMap["InitialMultiplayerEntrance"]();

        for (let row = entrance.rowMin; row <= entrance.rowMax; ++row)
        {
            for (let col = entrance.colMin; col <= entrance.colMax; ++col)
            {
                for (let collisionLayer = entrance.collisionLayerMin; collisionLayer <= entrance.collisionLayerMax; ++collisionLayer)
                {
                    VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer),
                        getNeighbouringWallTextureIndices(voxelGrid, row, col, collisionLayer));
                }
            }
        }
    },
    () => { // version 3 -> 4
        // Restricted zones added; older rooms get none.
    },
    (voxelGrid: VoxelGrid) => { // version 4 -> 5
        // Whether a quad is drawn stopped being stored (see VoxelQueryUtil.isVoxelQuadVisible), which
        // leaves its bit unused and zero.
        const quads = voxelGrid.quadsMem.quads;
        for (let i = 0; i < quads.length; ++i)
            quads[i] &= ~LEGACY_QUAD_VISIBLE_BIT;
    },
    () => { // version 5 -> 6
        // Blocks gained shapes, stored in the bit version 5 left unused (see Voxel). Older rooms hold
        // whole blocks only, as their readers leave them.
    },
];

const VoxelGridVersionMigration =
{
    // Fills an empty grid from bytes laid out as an older version, then converts it forward one version
    // at a time (see @docs/geometry/voxel_grid.md).
    decode: (bufferState: BufferState, voxelGrid: VoxelGrid, version: number, latestVersion: number): void =>
    {
        decoders[version](bufferState, voxelGrid);
        for (let fromVersion = version; fromVersion < latestVersion; ++fromVersion)
            converters[fromVersion](voxelGrid);
    },
}

// Texture indices of the wall beside the given cell (falls back to the first texture).
function getNeighbouringWallTextureIndices(voxelGrid: VoxelGrid, row: number, col: number,
    collisionLayer: number): number[]
{
    const quads = voxelGrid.quadsMem.quads;
    // The entrance is on an edge row, so its wall neighbours are the cells to either side in that row.
    const neighbours = [{row, col: col - 1}, {row, col: col + 1}];
    for (const neighbour of neighbours)
    {
        const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, neighbour.row, neighbour.col);
        if (!voxel || !VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
            continue;

        const textureIndices = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
            neighbour.row, neighbour.col, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            textureIndices[i] = quads[startIndex + i] & 0b01111111;
        return textureIndices;
    }
    return new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);
}

function addLegacyCornerWall(voxels: Voxel[], row: number, col: number,
    quadTextureIndicesWithinLayer: number[]): void
{
    for (let collisionLayer = 0; collisionLayer <= LEGACY_COLLISION_LAYER_MAX; ++collisionLayer)
    {
        VoxelUpdateUtil.addVoxelBlock(undefined, voxels,
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer),
            quadTextureIndicesWithinLayer);
    }
}

// Full-height voxels (see decodeFullHeightVoxel), with no restricted zones after them.
function decodeVoxelsOnlyFormat(bufferState: BufferState, voxelGrid: VoxelGrid): void
{
    decodeVoxels(bufferState, voxelGrid, decodeFullHeightVoxel);
}

// Full-height voxels, then the restricted zones.
function decodeVoxelsAndZonesFormat(bufferState: BufferState, voxelGrid: VoxelGrid): void
{
    decodeVoxelsOnlyFormat(bufferState, voxelGrid);

    const numZones = bufferState.view[bufferState.byteIndex++];
    if (numZones > MAX_RESTRICTED_ZONES)
        throw new Error(`Decoded restricted zone count is out of range (numZones = ${numZones})`);
    for (let i = 0; i < numZones; ++i)
        voxelGrid.restrictedZones.push(RestrictedZone.decode(bufferState) as RestrictedZone);
}

// One mask byte and 8 layers per cell, decoded into current quad memory with an empty upper half.
function decodeHalfHeightFormat(bufferState: BufferState, voxelGrid: VoxelGrid): void
{
    decodeVoxels(bufferState, voxelGrid, decodeHalfHeightVoxel);
}

function decodeVoxels(bufferState: BufferState, voxelGrid: VoxelGrid, decodeVoxel: (bufferState: BufferState,
    quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number) => Voxel): void
{
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            voxelGrid.voxels[row * NUM_VOXEL_COLS + col] = decodeVoxel(bufferState, voxelGrid.quadsMem, row, col);
    }
}

function decodeHalfHeightVoxel(bufferState: BufferState, quadsMem: VoxelQuadsRuntimeMemory,
    row: number, col: number): Voxel
{
    const quads = quadsMem.quads;

    quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];
    quads[VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];

    const collisionLayerMask = bufferState.view[bufferState.byteIndex++]; // one byte, hence eight layers

    // Upper layers stay empty (freshly allocated memory).
    decodeMaskedLayers(bufferState, quadsMem, row, col, collisionLayerMask, LEGACY_COLLISION_LAYER_MAX);
    return new Voxel(quadsMem, row, col);
}

// A voxel as versions 2 to 5 wrote it: its ceiling and floor quads, a two-byte mask of the layers holding
// a block, then the six quads of each of those layers.
function decodeFullHeightVoxel(bufferState: BufferState, quadsMem: VoxelQuadsRuntimeMemory,
    row: number, col: number): Voxel
{
    const quads = quadsMem.quads;

    quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];
    quads[VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];

    const collisionLayerMaskLowByte = bufferState.view[bufferState.byteIndex++];
    const collisionLayerMaskHighByte = bufferState.view[bufferState.byteIndex++];

    decodeMaskedLayers(bufferState, quadsMem, row, col,
        collisionLayerMaskLowByte | (collisionLayerMaskHighByte << 8), COLLISION_LAYER_MAX);
    return new Voxel(quadsMem, row, col);
}

// The layers of a voxel as every version up to 5 wrote them: six quad bytes for each layer the mask names,
// from the lowest up, each holding a whole block (no other kind existed).
function decodeMaskedLayers(bufferState: BufferState, quadsMem: VoxelQuadsRuntimeMemory,
    row: number, col: number, collisionLayerMask: number, collisionLayerMax: number): void
{
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= collisionLayerMax; ++collisionLayer)
    {
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        const layerHoldsBlock = ((1 << collisionLayer) & collisionLayerMask) != 0;
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadsMem.quads[i] = layerHoldsBlock ? bufferState.view[bufferState.byteIndex++] : 0;
        quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, collisionLayer)] =
            layerHoldsBlock ? VOXEL_BLOCK_SHAPE_WHOLE : VOXEL_BLOCK_SHAPE_EMPTY;
    }
}

export default VoxelGridVersionMigration;
