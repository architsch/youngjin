import Room from "../../../types/room";
import RoomBuilderParams from "../params/roomBuilderParams";

// One recipe for turning a solid grid of blocks into a room. Every room in the game comes out of one
// of these, and a builder is free to decide anything about the room it is handed - not only the
// voxels and objects in it, but every room-level parameter those were chosen to suit.
//
// The carving itself lives in RoomVolumeUtil rather than here: it is arithmetic on a volume, and a
// caller with a volume and a grid should not have to be a builder to use it.
export default abstract class RoomBuilder
{
    protected params: RoomBuilderParams;
    protected room: Room;

    constructor(params: RoomBuilderParams, room: Room)
    {
        this.params = params;
        this.room = room;
    }

    abstract run(): RoomBuilder;
}
