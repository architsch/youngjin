import Vec3 from "../../../shared/math/types/vec3";
import HelperPendingLines from "./helperPendingLines";

// A helper as the server plays it (see HelperAgentUtil). Its home is where the room keeps it, as an admin put it; where it
// is, the way it faces and what it says are shown to the room, and never kept.
type HelperState = {
    roomID: string,
    objectId: string,
    name: string,
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
    // Still while an admin holds it (see HoldObjectSignal), and until then, after an admin moved it or let go.
    heldBy: Set<string>,
    frozenUntil: number,
    // When it next wanders off, and when it heads home again once away.
    nextWanderAt: number,
    returnHomeAt: number,
    // When it last spoke, or was spoken to.
    lastTalkAt: number,
    // The login each visitor was last greeted in (see UserContext.loginCount), and when.
    greetedLogins: Map<string, {loginCount: number, at: number}>,
    greetings: {userID: string, name: string, returning: boolean}[],
    linesByUserID: Map<string, HelperPendingLines>,
    // Whom it is thinking of an answer to.
    answering: string | undefined,
    // What it has still to say, bubble by bubble, and whom each is for.
    bubbles: {text: string, to: string[]}[],
    nextBubbleAt: number,
    // Those in its room who have been told where it is, since the room they were sent keeps it at home.
    toldUserIDs: Set<string>,
};

export default HelperState;
