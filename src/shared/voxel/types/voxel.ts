import VoxelQuad from "./voxelQuad";

export default interface Voxel
{
    row: number;
    col: number;
    collisionLayerMask: number;
    quads: VoxelQuad[];
}