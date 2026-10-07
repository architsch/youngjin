import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_SUB_COLS, VOXEL_BLOCK_SHAPE_WHOLE }
    from "../../../../shared/system/sharedConstants";

// The light field is kept one sample per sub-block (see NUM_VOXEL_SUB_BLOCKS), so that light fills what a
// shrunk block leaves of its cell layer and stops at the rest. These go between that grid and the blocks'.

// From a block's first sub-block to the one beside it along x, and along z (see
// VoxelQueryUtil.getVoxelSubBlockIndex). The four are its shape's bits 0 to 3.
const COL_STRIDE = NUM_COLLISION_LAYERS;
const ROW_STRIDE = NUM_VOXEL_SUB_COLS * NUM_COLLISION_LAYERS;

const LightSubBlockUtil =
{
    // Which sub-blocks light can be in: those no block fills. Worked out once per recomputation, since every
    // pass asks it of every sub-block.
    markOpen(voxels: Voxel[] | undefined, outIsOpen: Uint8Array)
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
                const first = VoxelQueryUtil.getVoxelSubBlockIndex(2 * row, 2 * col, 0);
                for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                {
                    const shape = (voxel != undefined)
                        ? VoxelQueryUtil.getVoxelBlockShape(voxel, layer) : VOXEL_BLOCK_SHAPE_WHOLE;
                    const subBlockIndex = first + layer;
                    outIsOpen[subBlockIndex] = (shape & 0b0001) ? 0 : 1;
                    outIsOpen[subBlockIndex + COL_STRIDE] = (shape & 0b0010) ? 0 : 1;
                    outIsOpen[subBlockIndex + ROW_STRIDE] = (shape & 0b0100) ? 0 : 1;
                    outIsOpen[subBlockIndex + ROW_STRIDE + COL_STRIDE] = (shape & 0b1000) ? 0 : 1;
                }
            }
        }
    },

    // The light of each block, for what needs it no finer (see LightBlockDilationUtil): the mean over its open
    // sub-blocks. A block no more than half open stands across its cell like a wall, and counts as closed.
    averageOverBlocks(light: Float32Array, isOpen: Uint8Array, outBlockLight: Float32Array,
        outIsBlockOpen: Uint8Array)
    {
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const firstBlockIndex = VoxelQueryUtil.getVoxelBlockIndex(row, col, 0);
                const first = VoxelQueryUtil.getVoxelSubBlockIndex(2 * row, 2 * col, 0);
                for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                {
                    const lowXLowZ = first + layer;
                    const highXLowZ = lowXLowZ + COL_STRIDE;
                    const lowXHighZ = lowXLowZ + ROW_STRIDE;
                    const highXHighZ = lowXHighZ + COL_STRIDE;
                    const openLowXLowZ = isOpen[lowXLowZ], openHighXLowZ = isOpen[highXLowZ];
                    const openLowXHighZ = isOpen[lowXHighZ], openHighXHighZ = isOpen[highXHighZ];
                    const numOpen = openLowXLowZ + openHighXLowZ + openLowXHighZ + openHighXHighZ;

                    const blockIsOpen = numOpen > 2;
                    const toMean = blockIsOpen ? 1 / numOpen : 0;
                    const blockIndex = firstBlockIndex + layer;
                    outIsBlockOpen[blockIndex] = blockIsOpen ? 1 : 0;
                    for (let channel = 0; channel < 3; ++channel)
                    {
                        outBlockLight[blockIndex * 3 + channel] = toMean * (
                            light[lowXLowZ * 3 + channel] * openLowXLowZ +
                            light[highXLowZ * 3 + channel] * openHighXLowZ +
                            light[lowXHighZ * 3 + channel] * openLowXHighZ +
                            light[highXHighZ * 3 + channel] * openHighXHighZ);
                    }
                }
            }
        }
    },
}

export default LightSubBlockUtil;
