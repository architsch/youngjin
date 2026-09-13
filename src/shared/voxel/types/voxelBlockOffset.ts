// A step to a neighbouring block and its world distance (vertical steps are shorter than horizontal
// ones; counting steps alone would stretch distances vertically).
export default interface VoxelBlockOffset
{
    rowOffset: number;
    colOffset: number;
    collisionLayerOffset: number;
    worldDistance: number;
}
