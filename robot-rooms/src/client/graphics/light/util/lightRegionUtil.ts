import { MAX_ROOM_X, MAX_ROOM_Z, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, VOXEL_CELL_SIZE }
    from "../../../../shared/system/sharedConstants";
import { LIGHT_REGION_SIZE_XZ } from "../../../system/clientConstants";

const NUM_ROWS = MAX_ROOM_Z / LIGHT_REGION_SIZE_XZ;
const NUM_COLS = MAX_ROOM_X / LIGHT_REGION_SIZE_XZ;
const NUM_BLOCKS_PER_SIDE = LIGHT_REGION_SIZE_XZ / VOXEL_CELL_SIZE;

// The grid of regions the head light reads lamp light by (see LIGHT_REGION_SIZE_XZ), indexed as blocks are:
// layer fastest, then column, then row.
const LightRegionUtil =
{
    numRows: NUM_ROWS,
    numCols: NUM_COLS,
    numRegions: NUM_ROWS * NUM_COLS * NUM_COLLISION_LAYERS,

    // The light of each region: the mean over its open blocks. A region no more than half open stands
    // across its place like a wall, and counts as closed.
    averageOverRegions(light: Float32Array, isOpen: Uint8Array, outRegionLight: Float32Array,
        outIsRegionOpen: Uint8Array)
    {
        for (let regionRow = 0; regionRow < NUM_ROWS; ++regionRow)
        {
            for (let regionCol = 0; regionCol < NUM_COLS; ++regionCol)
            {
                const firstRegionIndex = (regionRow * NUM_COLS + regionCol) * NUM_COLLISION_LAYERS;
                for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                {
                    let numOpen = 0, sumR = 0, sumG = 0, sumB = 0;
                    for (let row = regionRow * NUM_BLOCKS_PER_SIDE; row < (regionRow + 1) * NUM_BLOCKS_PER_SIDE; ++row)
                    {
                        for (let col = regionCol * NUM_BLOCKS_PER_SIDE; col < (regionCol + 1) * NUM_BLOCKS_PER_SIDE; ++col)
                        {
                            const blockIndex = (row * NUM_VOXEL_COLS + col) * NUM_COLLISION_LAYERS + layer;
                            if (isOpen[blockIndex] === 0)
                                continue;
                            ++numOpen;
                            sumR += light[blockIndex * 3];
                            sumG += light[blockIndex * 3 + 1];
                            sumB += light[blockIndex * 3 + 2];
                        }
                    }

                    const regionIsOpen = 2 * numOpen > NUM_BLOCKS_PER_SIDE * NUM_BLOCKS_PER_SIDE;
                    const toMean = regionIsOpen ? 1 / numOpen : 0;
                    const regionIndex = firstRegionIndex + layer;
                    outIsRegionOpen[regionIndex] = regionIsOpen ? 1 : 0;
                    outRegionLight[regionIndex * 3] = toMean * sumR;
                    outRegionLight[regionIndex * 3 + 1] = toMean * sumG;
                    outRegionLight[regionIndex * 3 + 2] = toMean * sumB;
                }
            }
        }
    },
}

export default LightRegionUtil;
