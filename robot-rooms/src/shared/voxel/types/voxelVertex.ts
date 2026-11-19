// A corner of the voxel grid, where four voxels meet, at the bottom of a collision layer: where a walking body
// stands (see VoxelPathUtil). Row and column count the grid's lines, so a vertex sits at the corner shared by voxels
// (row - 1, col - 1) and (row, col).
export default interface VoxelVertex
{
    row: number;
    col: number;
    layer: number;
}
