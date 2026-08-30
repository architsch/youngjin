export type DoorType = number;

// What a door is for, as far as an arriving player is concerned. A room may hold several doors, and
// the server has to pick one to put an arriving player behind when nothing named a particular one
// (see SpawnHotspotUtil): a "default entrance" is a door that says it is willing to be that choice.
export const DoorTypeEnumMap: Record<string, number> =
{
    DefaultEntrance: 0,
    CustomEntrance: 1,
}
