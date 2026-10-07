// A block taken to have another shape than it has, to ask what would hold if it did (see
// ObjectAttachmentUtil.canPlaceObject).
export default interface VoxelBlockShapeOverride
{
    row: number,
    col: number,
    collisionLayer: number,
    shape: number,
}
