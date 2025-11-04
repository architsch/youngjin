import Voxel from "./voxel";

export default interface VoxelGrid
{
    numGridRows: number;
    numGridCols: number;
    voxels: Voxel[];
}