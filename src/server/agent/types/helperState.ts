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
    quarterTurns: number,
    saying: string,
    // Floor points still to walk, the next first, and what to turn to at the end.
    path: Vec3[],
    facePointAfterWalk: Vec3 | undefined,
    // Still while an admin holds it (see HoldObjectSignal), and until then, after an admin moved it or let go.
    heldBy: Set<string>,
    frozenUntil: number,
    // When it next wanders off, and when it heads home again once away.
    nextWanderAt: number,
    returnHomeAt: number,
    lastTalkAt: number,
    // The login each visitor was last greeted in (see UserContext.loginCount), and when.
    greetedLogins: Map<string, {loginCount: number, at: number}>,
    greetings: {userID: string, name: string, returning: boolean}[],
    linesByUserID: Map<string, HelperPendingLines>,
    answering: boolean,
    bubbles: string[],
    nextBubbleAt: number,
    // Those in its room who have been told where it is, since the room they were sent keeps it at home.
    toldUserIDs: Set<string>,
};

export default HelperState;
