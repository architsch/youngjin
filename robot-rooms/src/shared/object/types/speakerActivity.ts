export type SpeakerActivity = string;

// What a speaker is busy with, as its Activity metadata holds it: one at a time, which its bubble shows. Typing is a
// person or agent writing a line, or a helper thinking of an answer, and shows beside its name, its last words still
// up. Editing is a person in edit mode. Reading is a person with a page open over the game, or in another tab. The last
// two show in place of its words (see SpeakerActivityUtil.replacesWords).
export const SpeakerActivityEnumMap: Record<string, SpeakerActivity> =
{
    None: "",
    Typing: "t",
    Editing: "e",
    Reading: "r",
}
