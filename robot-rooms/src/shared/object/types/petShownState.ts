import { PetAction } from "./petAction";
import { PetExpression } from "./petExpression";

// What a pet shows of itself, as its PetState metadata holds it (see PetShownStateUtil): all a browser draws it from,
// and all another pet takes notice of.
export default interface PetShownState
{
    action: PetAction;
    expression: PetExpression;
    // Its eyes keep drooping shut: it is tired.
    sleepy: boolean;
    // Its battery is empty: its face flickers, and it does nothing but stand where it is.
    powerless: boolean;
    // It hops about what it is doing.
    excited: boolean;
    // How its words are colored (see PetSpeechToneEnumMap).
    tone: number;
    // The cells its battery indicator shows lit: none (empty) to PET_BATTERY_LEVELS.
    batteryLevel: number;
    // How rusty it looks, from none (0) to PET_RUST_LEVELS - 1.
    rust: number;
    // How many times it has struck what it attacks, counted round, so that each strike is shown once.
    hits: number;
    // What its chat with another pet is about, and how many lines of it have been said (see PetBehaviorUtil).
    topic: number;
    turn: number;
    // The way it faces across the floor while it stands (see NpcFacingUtil), or none: the way it last went.
    facing: number | undefined;
    // The object its action is about, by id: the pet it chats with or attacks, what it looks at, whom it speaks to or hugs.
    // "" for none.
    targetId: string;
}
