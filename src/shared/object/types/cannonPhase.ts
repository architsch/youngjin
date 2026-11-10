export type CannonPhase = number;

// What a cannon is doing, each for the time its state says is left of it (see CannonUtil). Stored, so never renumbered.
export const CannonPhaseEnumMap: Record<string, CannonPhase> =
{
    // Just installed or switched on: nothing yet.
    Resting: 0,
    // Until it next looks for someone to fire at, or, with no ball left, until it destroys itself.
    Waiting: 1,
    // Turning its barrel toward whoever it picked.
    Aiming: 2,
    // Aimed, and about to fire the way it points, wherever they have gone.
    Ready: 3,
}
