import Room from "../../../types/room";
import RoomBuilderParams from "../params/roomBuilderParams";
import RoomPalette from "../roomPalette";
import RoomPaletteSelector from "./helpers/roomPaletteSelector";

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

    // What the room is finished in. Every room settles this the same way, out of the candidates its
    // params allow it: a room offered one pack and one palette comes out plain throughout, and one
    // offered the run of the game's packs comes out decorated space by space.
    protected palettes = new RoomPaletteSelector();

    constructor(params: RoomBuilderParams, room: Room)
    {
        this.params = params;
        this.room = room;
    }

    // Settling what the room is finished in is the one thing every recipe does before anything
    // else, and so it is the whole of the base recipe: a room that shaped a space before it knew
    // its palettes would have nothing to finish that space in. Every recipe reaches this by calling
    // up the chain, so none can be written that forgets to.
    run(): RoomBuilder
    {
        this.room.texturePackPath = this.palettes.init(this.params.rand,
            this.params.paletteSelection);
        return this;
    }

    protected nextPalette(): RoomPalette
    {
        return this.palettes.next();
    }
}
