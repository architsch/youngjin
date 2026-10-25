import { ScreenControl } from "./screenControl";

// A piece of what a player or NPC says (see MessageLinkUtil): plain text, a link shown as its label, or a picture of a
// control on the screen.
type MessageSegment =
    | {kind: "text", text: string}
    | {kind: "link", href: string, label: string}
    | {kind: "control", control: ScreenControl};

export default MessageSegment;
