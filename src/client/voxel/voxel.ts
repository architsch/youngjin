import VoxelType from "./voxelType";

export default interface Voxel
{
    voxelType: VoxelType;
    textureId: string;
    row: number;
    col: number;
}