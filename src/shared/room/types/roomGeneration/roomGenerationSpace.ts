import RoomGenerationPalette from "./roomGenerationPalette";
import RoomGenerationVolume from "./roomGenerationVolume";

// One open space of a room: the volume it stands in, and the palette the surfaces enclosing it are
// finished in.
//
// A room is described entirely as the spaces standing open inside it, and is built by taking those
// spaces out of a solid mass of blocks. Everything the room is made of therefore comes out of what
// is left over: the floor under a space, the ceiling over it and the walls around it are simply the
// mass its faces meet, and a doorway or a stairwell is another space cut through that mass. Which
// is why nothing here describes a wall — a wall is a place no space reached.
export default interface RoomGenerationSpace
{
    volume: RoomGenerationVolume;
    palette: RoomGenerationPalette;
}
