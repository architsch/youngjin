export type PetSpeechTone = number;

// How a pet's words are colored in its bubble (see PetGameObject): as anyone's, or as a warning that it is dying or out
// of battery. Told to browsers that may hold an older table, so never renumbered.
export const PetSpeechToneEnumMap: Record<string, PetSpeechTone> =
{
    Normal: 0,
    Dying: 1,
    Powerless: 2,
}
