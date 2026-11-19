import { HelperRemarkKind } from "./helperRemarkKind";

// What a helper of one personality says of a thing it has gone to look at (see HelperRemarkUtil), by how much it likes
// it: loves, likes, neither, dislikes, or likes one thing in it and dislikes another. Each line has gaps that the thing
// fills ({thing} and {Thing}, which name it; {reason}, what it likes or dislikes in it; {other}, what it dislikes beside
// that), and gaps for words picked at random (see REMARK_WORDS); [a|b] is said as a for one thing, b for several.
// Lines for one kind of thing alone may name more of it ({title} and {painter} of a picture, {color} of a lamp).
type HelperRemarkVoice = {
    love: string[],
    like: string[],
    meh: string[],
    dislike: string[],
    mixed: string[],
    kinds: {[kind in HelperRemarkKind]?: {liked?: string[], disliked?: string[]}},
    // Its own words for some gaps, in place of everyone's.
    words?: {[gap: string]: string[]},
};

export default HelperRemarkVoice;
