// Where a block's box lies across its cell, each bound 0, 0.5 or 1 (see VoxelBlockShapeUtil). Its
// height is always its whole layer's.
export default interface VoxelBlockBounds
{
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
}
