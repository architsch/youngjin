// Why the Helper can't have a reply written (see HelperChatUtil): the day's replies are spent, or the hour's to the
// one talking to it, or no model is set up.
export type HelperChatRefusal = "dayLimit" | "hourlyLimit" | "noModel";
