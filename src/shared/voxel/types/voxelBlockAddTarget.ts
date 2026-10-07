// What adding a block on a face comes to (see VoxelQueryUtil.getVoxelBlockAddTarget).
export default interface VoxelBlockAddTarget
{
    // A quad of the cell layer the edit is made in, facing the way the face does.
    quadIndex: number;
    // The shape the block there ends up with.
    shape: number;
    // True where that is the face's own block, grown out to its cell's side; false for a new block beyond it.
    grows: boolean;
}
