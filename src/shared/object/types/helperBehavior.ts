import Vec3 from "../../math/types/vec3";
import { NpcPersonality } from "./npcPersonality";

// A helper as its behavior has it, wherever it is played (see HelperBehaviorUtil). Its home is where it was put; where it
// is, the way it faces and what it says are shown, and never kept.
type HelperBehavior = {
    // As an admin set them (see NpcObjectTypeConfig).
    name: string,
    wanderRadius: number,
    personality: NpcPersonality,
    home: Vec3,
    homeQuarterTurns: number,
    at: Vec3,
    // As shown (see NpcFacingUtil).
    facing: number,
    saying: string,
    // Floor points still to walk, the next first.
    path: Vec3[],
    // Whom it talks with, whom it looks at, and since when.
    talkingWith: string[],
    talkingSince: number,
    // Still until then, after it was moved or let go of.
    frozenUntil: number,
    // When it next wanders off, and when it heads home again once away.
    nextWanderAt: number,
    returnHomeAt: number,
    // When it last spoke, or was spoken to.
    lastTalkAt: number,
    // Whom it is thinking of an answer to.
    answering: string | undefined,
    // What it has still to say, bubble by bubble, and whom each is for.
    bubbles: {text: string, to: string[]}[],
    nextBubbleAt: number,
};

export default HelperBehavior;
