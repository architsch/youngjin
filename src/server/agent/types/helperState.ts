import HelperBehavior from "../../../shared/object/types/helperBehavior";
import HelperPendingLines from "./helperPendingLines";

// A helper as the server plays it, in a multiplayer room (see HelperAgentUtil): its behavior (see HelperBehaviorUtil), and
// besides, which room's NPC it is, who holds it, and whom it has greeted, is to greet and is to answer.
type HelperState = HelperBehavior & {
    roomID: string,
    objectId: string,
    // Still while an admin holds it (see HoldObjectSignal).
    heldBy: Set<string>,
    // The login each visitor was last greeted in (see UserContext.loginCount), and when.
    greetedLogins: Map<string, {loginCount: number, at: number}>,
    greetings: {userID: string, name: string, returning: boolean}[],
    linesByUserID: Map<string, HelperPendingLines>,
};

export default HelperState;
