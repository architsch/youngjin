/**
 * Stand-ins for the DOM's own classes, for suites that run without a DOM: what has the keyboard is read
 * through them (see KeyPressUtil.isTyping). Call stubFocus in beforeEach and vi.unstubAllGlobals in
 * afterEach.
 */
import { vi } from "vitest";

export class FakeElement
{
    isContentEditable = false;
}

export class FakeInput extends FakeElement
{
    constructor(public type: string) { super(); }
}

export class FakeTextArea extends FakeElement {}

/** Stands the classes in, with nothing focused. */
export function stubFocus(): void
{
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
    focus(null);
}

/** Gives the keyboard to an element, or to none. */
export function focus(element: FakeElement | null): void
{
    vi.stubGlobal("document", {activeElement: element});
}
