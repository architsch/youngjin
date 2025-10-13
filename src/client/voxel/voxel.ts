import VoxelObject from "../object/types/voxelObject";
import VoxelType from "./voxelType";

export default interface Voxel
{
    voxelType: VoxelType;
    textureId: string;
    uvStart: [number, number];
    row: number;
    col: number;
    object: VoxelObject | undefined;
}