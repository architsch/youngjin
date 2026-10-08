/**
 * Scenario tests: shortcut keys (see ShortcutKeyUtil, KeyPressUtil) — which keydown presses one, on
 * layouts that type no Latin letters too; the control a press goes to; the way a movement key points;
 * and Backspace standing in for Escape everywhere but in a text field. Focus is read through stand-ins
 * for the DOM's own classes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ShortcutKeyUtil from "../../../src/client/ui/util/shortcutKeyUtil";
import KeyPressUtil from "../../../src/client/ui/util/keyPressUtil";

class FakeElement
{
    isContentEditable = false;
}

class FakeInput extends FakeElement
{
    constructor(public type: string) { super(); }
}

class FakeTextArea extends FakeElement {}

function focus(element: FakeElement | null): void
{
    vi.stubGlobal("document", {activeElement: element});
}

function keyDown(key: string, code: string = key, more: Partial<KeyboardEvent> = {}): KeyboardEvent
{
    return {key, code, repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false,
        shiftKey: false, ...more} as KeyboardEvent;
}

// Each way a keydown is something other than one press of the key by itself.
const NOT_PLAIN: Partial<KeyboardEvent>[] = [{repeat: true}, {isComposing: true}, {ctrlKey: true},
    {metaKey: true}, {altKey: true}];

beforeEach(() => {
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
    focus(null);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the shortcut key a keydown presses", () => {
    it("is Enter or Delete by the key's name, on the numpad too", () => {
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("Enter"))).toBe("Enter");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("Enter", "NumpadEnter"))).toBe("Enter");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("Delete"))).toBe("Delete");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("Delete", "NumpadDecimal"))).toBe("Delete");
    });

    it("is M by the letter typed, in either case", () => {
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("m", "KeyM"))).toBe("M");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("M", "KeyM", {shiftKey: true}))).toBe("M");
        // AZERTY keeps its M where QWERTY has the semicolon, and a comma where QWERTY has M.
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("m", "Semicolon"))).toBe("M");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown(",", "KeyM"))).toBeUndefined();
    });

    it("is M by the key's place on a layout that types no Latin letters", () => {
        for (const typed of ["ㅡ", "ь", "μ", "צ"])
            expect(ShortcutKeyUtil.fromKeyDown(keyDown(typed, "KeyM"))).toBe("M");
        expect(ShortcutKeyUtil.fromKeyDown(keyDown("ㅜ", "KeyN"))).toBeUndefined();
    });

    it("is none for any other key", () => {
        for (const key of ["a", "n", " ", "Escape", "Backspace", "Tab", "Shift", "ArrowUp"])
            expect(ShortcutKeyUtil.fromKeyDown(keyDown(key))).toBeUndefined();
    });

    it("is none for a keydown that names no key, as a browser's autofill fires", () => {
        const unnamed = {} as KeyboardEvent;
        expect(ShortcutKeyUtil.fromKeyDown(unnamed)).toBeUndefined();
        expect(KeyPressUtil.isEscape(unnamed)).toBe(false);
    });

    it("is none for a held key repeating, a chord, or a key an IME is composing with", () => {
        for (const more of NOT_PLAIN)
        {
            for (const [key, code] of [["Enter", "Enter"], ["Delete", "Delete"], ["m", "KeyM"]])
                expect(ShortcutKeyUtil.fromKeyDown(keyDown(key, code, more))).toBeUndefined();
        }
    });
});

describe("the control a shortcut key's press goes to", () => {
    it("is the newest one on screen for that key, then the one before it once that is gone", () => {
        const clicked: string[] = [];
        const older = ShortcutKeyUtil.register("Delete", () => clicked.push("older"));
        const newer = ShortcutKeyUtil.register("Delete", () => clicked.push("newer"));

        ShortcutKeyUtil.press("Delete");
        expect(clicked).toEqual(["newer"]);

        ShortcutKeyUtil.unregister(newer);
        ShortcutKeyUtil.press("Delete");
        expect(clicked).toEqual(["newer", "older"]);

        ShortcutKeyUtil.unregister(older);
        ShortcutKeyUtil.press("Delete");
        expect(clicked).toEqual(["newer", "older"]);
    });

    it("is never a control of another key", () => {
        const clicked: string[] = [];
        const remove = ShortcutKeyUtil.register("Delete", () => clicked.push("remove"));
        const mode = ShortcutKeyUtil.register("M", () => clicked.push("mode"));

        ShortcutKeyUtil.press("Enter");
        expect(clicked).toEqual([]);
        ShortcutKeyUtil.press("Delete");
        expect(clicked).toEqual(["remove"]);

        ShortcutKeyUtil.unregister(remove);
        ShortcutKeyUtil.unregister(mode);
    });
});

describe("the way a movement key points", () => {
    it("is an arrow's own way, and W, A, S and D's as they lie around the hand", () => {
        expect(KeyPressUtil.getDirection(keyDown("ArrowUp"))).toBe("up");
        expect(KeyPressUtil.getDirection(keyDown("ArrowDown"))).toBe("down");
        expect(KeyPressUtil.getDirection(keyDown("ArrowLeft"))).toBe("left");
        expect(KeyPressUtil.getDirection(keyDown("ArrowRight"))).toBe("right");

        expect(KeyPressUtil.getDirection(keyDown("w", "KeyW"))).toBe("up");
        expect(KeyPressUtil.getDirection(keyDown("s", "KeyS"))).toBe("down");
        expect(KeyPressUtil.getDirection(keyDown("a", "KeyA"))).toBe("left");
        expect(KeyPressUtil.getDirection(keyDown("D", "KeyD", {shiftKey: true}))).toBe("right");
    });

    it("goes by the key's place, whatever letter the layout types there", () => {
        // AZERTY has Z and Q where QWERTY has W and A, and W where QWERTY has Z.
        expect(KeyPressUtil.getDirection(keyDown("z", "KeyW"))).toBe("up");
        expect(KeyPressUtil.getDirection(keyDown("q", "KeyA"))).toBe("left");
        expect(KeyPressUtil.getDirection(keyDown("w", "KeyZ"))).toBeUndefined();
        expect(KeyPressUtil.getDirection(keyDown("ㅈ", "KeyW"))).toBe("up");
    });

    it("is none for any other key, or for a keydown that names no key", () => {
        for (const [key, code] of [["m", "KeyM"], ["Enter", "Enter"], [" ", "Space"], ["Delete", "Delete"]])
            expect(KeyPressUtil.getDirection(keyDown(key, code))).toBeUndefined();
        expect(KeyPressUtil.getDirection({} as KeyboardEvent)).toBeUndefined();
    });
});

describe("Backspace standing in for Escape", () => {
    it("does so with nothing focused, or with a control that takes no typing", () => {
        expect(KeyPressUtil.isEscape(keyDown("Backspace"))).toBe(true);

        for (const type of ["range", "color", "checkbox", "button"])
        {
            focus(new FakeInput(type));
            expect(KeyPressUtil.isEscape(keyDown("Backspace"))).toBe(true);
        }
        focus(new FakeElement());
        expect(KeyPressUtil.isEscape(keyDown("Backspace"))).toBe(true);
    });

    it("is left to a text field that has the keyboard", () => {
        const editable = new FakeElement();
        editable.isContentEditable = true;
        const textFields = [...["text", "search", "email", "password", "number"].map(type => new FakeInput(type)),
            new FakeTextArea(), editable];

        for (const textField of textFields)
        {
            focus(textField);
            expect(KeyPressUtil.isTyping()).toBe(true);
            expect(KeyPressUtil.isEscape(keyDown("Backspace"))).toBe(false);
        }
    });

    it("takes one press of the key by itself", () => {
        for (const more of NOT_PLAIN)
            expect(KeyPressUtil.isEscape(keyDown("Backspace", "Backspace", more))).toBe(false);
    });

    it("leaves Escape itself what it was, held or in a text field", () => {
        expect(KeyPressUtil.isEscape(keyDown("Escape"))).toBe(true);
        expect(KeyPressUtil.isEscape(keyDown("Escape", "Escape", {repeat: true}))).toBe(true);
        focus(new FakeInput("text"));
        expect(KeyPressUtil.isEscape(keyDown("Escape"))).toBe(true);
    });
});
