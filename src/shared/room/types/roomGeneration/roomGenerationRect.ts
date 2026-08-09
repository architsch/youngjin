// A rectangular patch of the voxel grid. This is the unit every room generation routine works
// in: regions, wall lines, doorways and cleared-out areas are all expressed as one of these.
export default interface RoomGenerationRect
{
    rowStart: number;
    colStart: number;
    numRows: number;
    numCols: number;
}
