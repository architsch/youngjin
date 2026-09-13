export type DoorType = number;

// A "default entrance" is eligible for arrivals that don't name a door (see SpawnHotspotUtil).
export const DoorTypeEnumMap: Record<string, number> =
{
    DefaultEntrance: 0,
    CustomEntrance: 1,
}
