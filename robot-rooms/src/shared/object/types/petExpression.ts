export type PetExpression = number;

// The face a pet's screen shows (see PetFaceUtil), as whoever plays it shows the room. Told to browsers that may hold an
// older table, so never renumbered.
export const PetExpressionEnumMap: Record<string, PetExpression> =
{
    // Eyes open, mouth level.
    Neutral: 0,
    // Mouth curved up, and down.
    Happy: 1,
    Sad: 2,
    // Eyes wide, mouth an "O".
    Surprised: 3,
    // Eyes shut, mouth level.
    Asleep: 4,
    // Eyes slanted in toward each other, mouth curved down.
    Angry: 5,
    // Eyes an "X" each, mouth an "O".
    Panicked: 6,
    // Nothing: a dark screen.
    Off: 7,
}
