import HelperBehavior from "../../../shared/object/types/helperBehavior";

// A helper the browser plays in a single-player room (see SinglePlayerHelperUtil): its behavior (see HelperBehaviorUtil),
// and besides, which NPC it is, whether it has greeted the user, what they said to it that awaits an answer and since
// when, and whether an admin held it at the last look.
type SinglePlayerHelper = HelperBehavior & {
    objectId: string,
    greeted: boolean,
    lines: string[],
    linesAt: number,
    held: boolean,
};

export default SinglePlayerHelper;
