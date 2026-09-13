export type RoomVolumeType = string;

// A volume's purpose. The plan is applied by type (hollowed, filled, or reserved), so a new kind of
// volume is a new entry here.
export const RoomVolumeTypeEnumMap: Record<string, RoomVolumeType> =
{
    Area: "Area",           // one of the spaces the room is made of
    Passage: "Passage",     // an opening cut through the wall between two areas
    Stairwell: "Stairwell", // the shaft a flight of steps climbs through
    Step: "Step",           // one step of a flight, stood back up after the carving
    Reserved: "Reserved",   // a stretch of the room nothing generation places may stand in
}
