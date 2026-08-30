export type RoomVolumeType = string;

// What a RoomVolume is *for*, which is the one thing about a volume its bounds cannot say. A
// procedurally generated room is planned entirely as volumes gathered under these, and the plan is
// applied by type: every volume of one type is hollowed out of the matter, every volume of another
// is stood back up in it, and one type is neither - it only marks a stretch of the room that
// nothing generation places may go into.
//
// Holding them under one key rather than in an array each is what keeps that possible: a routine
// applying the plan reads the types it acts on, so a new kind of volume is a new entry here rather
// than a new field for everything to remember.
export const RoomVolumeTypeEnumMap: Record<string, RoomVolumeType> =
{
    Area: "Area",           // one of the spaces the room is made of
    Passage: "Passage",     // an opening cut through the wall between two areas
    Stairwell: "Stairwell", // the shaft a flight of steps climbs through
    Step: "Step",           // one step of a flight, stood back up after the carving
    Reserved: "Reserved",   // a stretch of the room nothing generation places may stand in
}
