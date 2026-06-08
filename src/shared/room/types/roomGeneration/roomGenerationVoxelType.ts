export enum RoomGenerationVoxelType
{
    Wall, // = A wall made up of a stack of voxel blocks (All collisionLayers are occupied)
    Floor, // = An empty space that is not occupied by a wall.
}