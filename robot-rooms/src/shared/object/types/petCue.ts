// A moment a pet has a word for (see PetLineMap): pressing up against someone, setting on another pet, being set on,
// taking fright, being woken, being given a battery or a wrench, hurrying after its owner, hearing its name, and
// being spoken to with no answer of its own to be had (see PetChatUtil).
export type PetCue = "hug" | "attack" | "attacked" | "panic" | "woken" | "charged" | "repaired" | "follow" | "called"
    | "wordless";
