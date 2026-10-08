import ScreenDirection from "../../graphics/types/screenDirection";

// What a keydown means beyond the key it names.
const KeyPressUtil =
{
    // The way a movement key points: an arrow, or W, A, S or D by its place on the keyboard, whatever letter the
    // layout types there. Undefined for any other key.
    getDirection: (ev: KeyboardEvent): ScreenDirection | undefined =>
    {
        return DIRECTION_BY_KEY_CODE.get(ev.code);
    },
    // One press of a key by itself: a held key repeats, and a chord belongs to the browser or the system.
    isPlain: (ev: KeyboardEvent): boolean =>
    {
        return !ev.repeat && !ev.isComposing && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    },
    // Whether a text field has the keyboard, and so every key that types or edits.
    isTyping: (): boolean =>
    {
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement)
            return !NON_TEXT_INPUT_TYPES.includes(focused.type);
        return focused instanceof HTMLTextAreaElement
            || (focused instanceof HTMLElement && focused.isContentEditable);
    },
    // Escape, or Backspace standing in for it wherever it isn't editing text.
    isEscape: (ev: KeyboardEvent): boolean =>
    {
        return ev.key == "Escape"
            || (ev.key == "Backspace" && KeyPressUtil.isPlain(ev) && !KeyPressUtil.isTyping());
    },
}

const DIRECTION_BY_KEY_CODE = new Map<string, ScreenDirection>([
    ["ArrowUp", "up"], ["KeyW", "up"],
    ["ArrowDown", "down"], ["KeyS", "down"],
    ["ArrowLeft", "left"], ["KeyA", "left"],
    ["ArrowRight", "right"], ["KeyD", "right"],
]);

// The <input> types that take no typing.
const NON_TEXT_INPUT_TYPES = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset",
    "submit"];

export default KeyPressUtil;
