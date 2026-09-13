import Room from "../../../types/room";
import RoomBuilderParams from "../params/roomBuilderParams";
import RoomPalette from "../roomPalette";
import RoomPaletteSelector from "./helpers/roomPaletteSelector";

// A recipe producing a room: voxels, objects and room-level parameters. Carving math lives in
// RoomVolumeUtil so it's usable without a builder.
export default abstract class RoomBuilder
{
    protected params: RoomBuilderParams;
    protected room: Room;

    // Palette selection; one pack and one palette gives a plain room.
    protected palettes = new RoomPaletteSelector();

    constructor(params: RoomBuilderParams, room: Room)
    {
        this.params = params;
        this.room = room;
    }

    // Base recipe: choose palettes first (nothing can be finished without them). Subclasses call up the
    // chain, so none can skip it.
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
