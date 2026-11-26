export type PetAction = number;

// What a pet is doing (see PetBehaviorUtil), as whoever plays it shows the room. Told to browsers that may hold an older
// table, so never renumbered.
export const PetActionEnumMap: Record<string, PetAction> =
{
    // Nothing in particular: it stands where it is.
    Idle: 0,
    Wander: 1,
    // A chat with another pet, by the object id it shows.
    SmallTalk: 2,
    // A word on something placed near it, and one on what someone has just built or changed.
    ObjectRemark: 3,
    EditRemark: 4,
    // Charging at another pet, by the object id it shows, again and again.
    Attack: 5,
    // Running about in a fright.
    Panic: 6,
    Sleep: 7,
    // Going up to someone who said its name, by their player's object id.
    Come: 8,
    // Pressing up against someone.
    Hug: 9,
    // Running from what attacked it, or frightened it.
    Flee: 10,
    // Out of health: about to be taken away, and left as scrap.
    Dead: 11,
    // A word to someone near it, by their player's object id.
    PersonRemark: 12,
    // Turned to someone who spoke to it, by their player's object id, to answer them.
    Chat: 13,
}
