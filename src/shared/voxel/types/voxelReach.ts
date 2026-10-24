import VoxelVertex from "./voxelVertex";

// Where a walking body can get to from the vertex it starts on, as VoxelPathUtil.findReach finds it: the vertices it
// reaches, nearest first, and for the way to each, the vertex each is stepped onto from (by VoxelPathUtil's keys).
type VoxelReach = {
    start: VoxelVertex,
    vertices: VoxelVertex[],
    cameFrom: Map<number, number>,
};

export default VoxelReach;
