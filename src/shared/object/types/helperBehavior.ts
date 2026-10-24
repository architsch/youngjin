import Vec3 from "../../math/types/vec3";
import BehaviorPrefs from "./behaviorPrefs";
import HelperSmallTalk from "./helperSmallTalk";

// A helper as its behavior has it, wherever it is played (see HelperBehaviorUtil). Its home is where it was put; where it
// is, the way it faces and what it says are shown, and never kept.
type HelperBehavior = {
    // As an admin set them: its name, and how it is played.
    name: string,
    prefs: BehaviorPrefs,
    home: Vec3,
    homeQuarterTurns: number,
    at: Vec3,
    // As shown (see NpcFacingUtil).
    facing: number,
    saying: string,
    // Floor points still to walk, the next first: each a grid vertex, but for home at the end of a way there. What the
    // walk is for, and since when it has stood blocked on its way, if it has.
    path: Vec3[],
    walk: "wander" | "home" | "meet",
    blockedSince: number | undefined,
    // Whom it talks with, whom it looks at, and since when.
    talkingWith: string[],
    talkingSince: number,
    // Still until then, after it was moved or let go of.
    frozenUntil: number,
    // When it next wanders off, and when it heads home again once away.
    nextWanderAt: number,
    returnHomeAt: number,
    // When it last spoke with someone, or was spoken to.
    lastTalkAt: number,
    // Whom it is thinking of an answer to.
    answering: string | undefined,
    // Whether it is shown thinking of an answer (see Thinking): from when it hears a line until it says its answer,
    // or has none to say.
    thinking: boolean,
    // What it has still to say, bubble by bubble, whom each is for, and whether it is an answer.
    bubbles: {text: string, to: string[], answer: boolean}[],
    nextBubbleAt: number,
    // The chat it is having with another helper, if it is, and when it may begin another.
    smallTalk: HelperSmallTalk | undefined,
    nextSmallTalkAt: number,
};

export default HelperBehavior;
