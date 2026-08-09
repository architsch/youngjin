import RoomGenerationPalette from "./roomGenerationPalette";
import RoomGenerationRect from "./roomGenerationRect";

// One room-within-the-room produced by a generator: the floor area it occupies, together with
// the textures it is finished in. Carrying the two around as a pair is what lets everything
// added afterwards (doorways through its walls, decorations standing inside it) match the
// region it belongs to.
export default interface RoomGenerationRegion
{
    rect: RoomGenerationRect;
    palette: RoomGenerationPalette;
}
