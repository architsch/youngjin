// Which of the platform's "go back / close this" signals arrived. They are told apart because
// only one of them carries a default behavior worth deferring to: a back gesture would have taken
// the user off the page, whereas the Escape key would have done nothing at all.
export type CloseGestureKind = "escape" | "back";
