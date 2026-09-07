import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../../shared/system/sharedConstants";

// Softens an accumulated light field across neighbouring blocks.
//
// Why it is needed: the field is sampled by the shader through the texture's own linear filtering,
// which joins the block centres with straight lines. That is continuous but its slope is not — the
// slope changes abruptly at every block boundary — and the eye reads a field of abruptly changing
// slopes as facets. The steeper the falloff, the larger the change and the more plainly the room
// comes out in blocks. Widening what each block holds to include its neighbours flattens those
// changes, and is also simply what light does: a room is lit by every surface in it, not only by the
// lamp.
//
// It is a separable pass — one sweep along each axis rather than one sweep over a 27-block
// neighbourhood — which is the same result for a ninth of the work.

// A tent: a block keeps half of what it holds and takes a quarter from each side. Held deliberately
// narrow, since this runs once per axis and a wider kernel starts to move light noticeably away from
// the lamp that cast it.
const CENTER_WEIGHT = 0.5;
const NEIGHBOR_WEIGHT = 0.25;

const LightBlockSmoothingUtil =
{
    // Marks which blocks light is allowed to occupy at all. Worked out once and handed to every
    // sweep, since a sweep asks about three blocks for each one it writes and reading the voxel grid
    // that many times costs more than the sweep itself.
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

    // Smooths in place, using the scratch buffer to sweep through. Both buffers hold three entries
    // per block; the light field and the direction field are both swept, since a direction that
    // still turned block by block would band a wall the smoothed brightness no longer does.
    smooth(field: Float32Array, scratch: Float32Array, isOpen: Uint8Array)
    {
        // The stride between neighbouring blocks along each axis, which follows the block index's
        // layout: the collision layer varies fastest, then the column, then the row.
        const layerStride = 1;
        const colStride = NUM_COLLISION_LAYERS;
        const rowStride = NUM_VOXEL_COLS * NUM_COLLISION_LAYERS;

        sweep(field, scratch, isOpen, layerStride, NUM_COLLISION_LAYERS);
        sweep(scratch, field, isOpen, colStride, NUM_VOXEL_COLS);
        sweep(field, scratch, isOpen, rowStride, NUM_VOXEL_ROWS);
        field.set(scratch);
    },
}

// One sweep along one axis. A solid block is not a dark neighbour but no neighbour at all: it is left
// out of the average and the weights are renormalized without it, so that light never crosses a wall
// on its way to being smoothed — which would undo the very thing the flood fill went to the trouble
// of respecting.
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

        // Where this block sits along the axis being swept, so that the sweep stops at the grid's
        // edge rather than wrapping onto the far side of the room.
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
