// A body as it walks the voxel grid (see VoxelPathUtil): how many layers tall it stands, and how many it climbs in one
// step (see ColliderConfig.maxClimbableHeight).
type VoxelWalker = {
    bodyLayers: number,
    climbLayers: number,
};

export default VoxelWalker;
