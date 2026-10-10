import { NUM_COLLISION_LAYERS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_VOXEL } from "../../system/sharedConstants";
import LegacyRestrictedZone from "./legacyRestrictedZone";

// The grid as format versions up to 6 held it (see VoxelGridVersionMigration): cells one world unit wide,
// each layer of one holding a block that fills all of it, half of it or a quarter.
export default class LegacyVoxelGrid
{
    static readonly numRows = 32;
    static readonly numCols = 32;

    // A block filling its whole cell layer, which is all there was before version 6 (see blockShapes).
    static readonly wholeBlockShape = 0b1111;

    // One byte per quad, a cell's laid out as a voxel's are (see Voxel).
    quads = new Uint8Array(LegacyVoxelGrid.numRows * LegacyVoxelGrid.numCols * NUM_VOXEL_QUADS_PER_VOXEL);

    // One per cell layer: which of its four half-cell sub-blocks its block fills, one bit each
    // (bit = x half + 2 * z half), or none where there is no block.
    blockShapes = new Uint8Array(LegacyVoxelGrid.numRows * LegacyVoxelGrid.numCols * NUM_COLLISION_LAYERS);

    restrictedZones: LegacyRestrictedZone[] = [];

    getFirstQuadIndexInLayer(row: number, col: number, collisionLayer: number): number
    {
        return (row * LegacyVoxelGrid.numCols + col) * NUM_VOXEL_QUADS_PER_VOXEL +
            NUM_VOXEL_QUADS_PER_COLLISION_LAYER * collisionLayer;
    }

    // A cell's last two quads are those of the room's own ceiling and floor over it.
    getCeilingQuadIndex(row: number, col: number): number
    {
        return (row * LegacyVoxelGrid.numCols + col + 1) * NUM_VOXEL_QUADS_PER_VOXEL - 2;
    }

    getFloorQuadIndex(row: number, col: number): number
    {
        return (row * LegacyVoxelGrid.numCols + col + 1) * NUM_VOXEL_QUADS_PER_VOXEL - 1;
    }

    getBlockIndex(row: number, col: number, collisionLayer: number): number
    {
        return (row * LegacyVoxelGrid.numCols + col) * NUM_COLLISION_LAYERS + collisionLayer;
    }

    // Puts a whole block into a cell layer, with the given texture on each of its six quads.
    addWholeBlock(row: number, col: number, collisionLayer: number, quadTextureIndices: number[]): void
    {
        this.blockShapes[this.getBlockIndex(row, col, collisionLayer)] = LegacyVoxelGrid.wholeBlockShape;
        const firstQuadIndex = this.getFirstQuadIndexInLayer(row, col, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            this.quads[firstQuadIndex + i] = quadTextureIndices[i] & 0b01111111;
    }
}
