// A step from one voxel block to a neighbouring one, and how far that step actually travels through
// the world. The two are not the same thing: a voxel block is a whole voxel across in X and Z but
// only one collision layer tall, so a step up or down covers less ground than a step sideways.
// Anything that measures distance by counting steps would therefore reach further vertically than
// horizontally — drawing a ball as a tall column.
export default interface VoxelBlockOffset
{
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;
    worldDistance: number;
}
