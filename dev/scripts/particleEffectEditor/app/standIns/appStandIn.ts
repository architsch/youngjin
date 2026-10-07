import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE }
    from "../../../../../src/shared/system/sharedConstants";
import Voxel from "../../../../../src/shared/voxel/types/voxel";
import VoxelQuadsRuntimeMemory from "../../../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import VoxelQueryUtil from "../../../../../src/shared/voxel/util/voxelQueryUtil";

// App as the particle system sees it (see server.js): an empty room, so landing particles find its floor, and
// any block the preview stands in it.
const quadsMem = new VoxelQuadsRuntimeMemory();
const voxels: Voxel[] = [];
for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
{
    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        voxels.push(new Voxel(quadsMem, row, col));
}
const room = {voxelGrid: {voxels}};

const AppStandIn =
{
    getCurrentRoom: () =>
    {
        return room;
    },
    setBlock: (row: number, col: number, collisionLayer: number, occupied: boolean): void =>
    {
        quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, collisionLayer)] =
            occupied ? VOXEL_BLOCK_SHAPE_WHOLE : VOXEL_BLOCK_SHAPE_EMPTY;
    },
}

export default AppStandIn;
