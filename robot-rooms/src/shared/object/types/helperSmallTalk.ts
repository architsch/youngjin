import HelperBehavior from "./helperBehavior";

// A chat between two helpers near each other, which both hold while it lasts (see HelperBehaviorUtil): fixed words, as
// whoever plays them was given them (see HelperSmallTalkUtil), said in turn, each once the one before has been read.
type HelperSmallTalk = {
    helpers: HelperBehavior[],
    // What is still to be said, the next first, each line by its speaker's place in helpers.
    lines: {by: number, text: string}[],
    // Who said the last line, whose words alone stay up.
    saidLast: HelperBehavior | undefined,
};

export default HelperSmallTalk;
