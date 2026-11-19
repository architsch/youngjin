// How much a helper likes a thing it looks at (see HelperRemarkUtil): it loves or likes what it likes most in it,
// neither likes nor dislikes anything in it, dislikes what it dislikes in it, or likes one thing in it and dislikes
// another.
export type HelperRemarkTaste = "love" | "like" | "meh" | "dislike" | "mixed";
