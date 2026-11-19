export type CannonPhase = number;

// What a cannon is doing, each but its aiming and its lying as scrap for the time its state says is left of it (see
// CannonUtil). Stored, so never renumbered.
export const CannonPhaseEnumMap: Record<string, CannonPhase> =
{
    // Just installed or switched on: nothing yet.
    Resting: 0,
    // Until it next turns to someone; with no ball left, until it turns to scrap; its row fired, until it switches
    // itself off.
    Waiting: 1,
    // Turning its barrel toward whoever is nearest, for as long as it takes to be aimed at them.
    Aiming: 2,
    // Aimed, and about to fire the way it points, wherever they have gone.
    Ready: 3,
    // Its last ball fired: scrap, for good, with no time left to run out.
    Scrap: 4,
}
