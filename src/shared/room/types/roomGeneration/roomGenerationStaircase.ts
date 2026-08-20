import RoomGenerationPalette from "./roomGenerationPalette";
import RoomGenerationVolume from "./roomGenerationVolume";

// One flight of steps joining a room's two storeys, as a plan rather than as blocks: where its
// footprint sits, which way it is turned, and the palette its treads and sides are finished in.
//
// A flight doubles back on itself, so its footprint is two lanes side by side — one climbing away
// from the entry, one climbing back — rather than a single long run. That is what lets a staircase
// stand in a room of the size these are cut into: a straight run tall enough to reach the storey
// above would be longer than most of the rooms it would have to stand in. Each lane is several
// cells wide (see RoomGenerationStairsUtil), so the footprint is wider than it is long.
export default interface RoomGenerationStaircase
{
    volume: RoomGenerationVolume; // the whole footprint, landing included, over the room's full height
    alongCols: boolean; // whether the lanes run along the columns rather than along the rows
    ascendsForward: boolean; // whether the first lane climbs towards the volume's far end or its near one
    palette: RoomGenerationPalette;
}
