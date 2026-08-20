// A box of the voxel grid: a rectangle of cells over a stretch of the room's height.
//
// This is the one shape the room generation system works in. A room's spaces, the doorways between
// them, the stairwells that join its floors and the stretches of it that have to be kept clear are
// all one of these, so a room is laid out in three dimensions from the start rather than as a flat
// plan that something else is left to give a height to.
export default interface RoomGenerationVolume
{
    rowStart: number;
    colStart: number;
    numRows: number;
    numCols: number;
    collisionLayerStart: number;
    numCollisionLayers: number;
}
