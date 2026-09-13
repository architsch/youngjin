import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../../shared/system/sharedConstants";

// Smooths the light field across neighbouring blocks. Linear texture filtering has slope
// discontinuities at block boundaries that read as facets. Separable per-axis sweeps.

// Narrow tent kernel; wider would visibly shift light away from its lamp.
const CENTER_WEIGHT = 0.5;
const NEIGHBOR_WEIGHT = 0.25;

const LightBlockSmoothingUtil =
{
    // Precomputed once, since sweeps would otherwise read the voxel grid repeatedly.
    markOpenBlocks(voxels: Voxel[] | undefined, outIsOpen: Uint8Array)
    {
        if (voxels == undefined)
        {
            outIsOpen.fill(0);
            return;
        }
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
                for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                {
                    const blockIndex = VoxelQueryUtil.getVoxelBlockIndex(row, col, layer);
                    outIsOpen[blockIndex] = (voxel != undefined &&
                        !VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer)) ? 1 : 0;
                }
            }
        }
    },

    // In place; 3 entries per block. Also applied to the direction field, which would otherwise band.
    smooth(field: Float32Array, scratch: Float32Array, isOpen: Uint8Array)
    {
        // Strides follow the block index layout: layer fastest, then column, then row.
        const layerStride = 1;
        const colStride = NUM_COLLISION_LAYERS;
        const rowStride = NUM_VOXEL_COLS * NUM_COLLISION_LAYERS;

        sweep(field, scratch, isOpen, layerStride, NUM_COLLISION_LAYERS);
        sweep(scratch, field, isOpen, colStride, NUM_VOXEL_COLS);
        sweep(field, scratch, isOpen, rowStride, NUM_VOXEL_ROWS);
        field.set(scratch);
    },
}

// Solid blocks are excluded and weights renormalized, so light never crosses walls while smoothing.
function sweep(source: Float32Array, target: Float32Array, isOpen: Uint8Array,
    stride: number, axisLength: number)
{
    for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
    {
        const at = blockIndex * 3;
        if (isOpen[blockIndex] === 0)
        {
            target[at] = 0;
            target[at + 1] = 0;
            target[at + 2] = 0;
            continue;
        }

        // Prevents wrapping across the grid edge.
        const positionAlongAxis = Math.floor(blockIndex / stride) % axisLength;
        const hasLower = positionAlongAxis > 0 && isOpen[blockIndex - stride] === 1;
        const hasUpper = positionAlongAxis < axisLength - 1 && isOpen[blockIndex + stride] === 1;

        let totalWeight = CENTER_WEIGHT;
        let sumX = source[at] * CENTER_WEIGHT;
        let sumY = source[at + 1] * CENTER_WEIGHT;
        let sumZ = source[at + 2] * CENTER_WEIGHT;

        if (hasLower)
        {
            const lower = (blockIndex - stride) * 3;
            sumX += source[lower] * NEIGHBOR_WEIGHT;
            sumY += source[lower + 1] * NEIGHBOR_WEIGHT;
            sumZ += source[lower + 2] * NEIGHBOR_WEIGHT;
            totalWeight += NEIGHBOR_WEIGHT;
        }
        if (hasUpper)
        {
            const upper = (blockIndex + stride) * 3;
            sumX += source[upper] * NEIGHBOR_WEIGHT;
            sumY += source[upper + 1] * NEIGHBOR_WEIGHT;
            sumZ += source[upper + 2] * NEIGHBOR_WEIGHT;
            totalWeight += NEIGHBOR_WEIGHT;
        }

        const normalize = 1 / totalWeight;
        target[at] = sumX * normalize;
        target[at + 1] = sumY * normalize;
        target[at + 2] = sumZ * normalize;
    }
}

export default LightBlockSmoothingUtil;
