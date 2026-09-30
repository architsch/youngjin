import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../../../src/shared/system/sharedConstants";

// App as the particle system sees it (see server.js): an empty room, so landing particles find its floor, and
// any block the preview stands in it.
const voxels = Array.from({length: NUM_VOXEL_ROWS * NUM_VOXEL_COLS}, () => ({collisionLayerMask: 0}));
const room = {voxelGrid: {voxels}};

const AppStandIn =
{
    getCurrentRoom: () =>
    {
        return room;
    },
    setBlock: (row: number, col: number, collisionLayer: number, occupied: boolean): void =>
    {
        const voxel = voxels[row * NUM_VOXEL_COLS + col];
        voxel.collisionLayerMask = occupied
            ? (voxel.collisionLayerMask | (1 << collisionLayer))
            : (voxel.collisionLayerMask & ~(1 << collisionLayer));
    },
}

export default AppStandIn;
