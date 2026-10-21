// A piece of what a player or NPC says (see MessageLinkUtil): plain text, or a link shown as its label.
type MessageSegment =
    | {kind: "text", text: string}
    | {kind: "link", href: string, label: string};

export default MessageSegment;
