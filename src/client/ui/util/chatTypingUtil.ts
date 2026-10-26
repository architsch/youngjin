import { chatTypingObservable } from "../../system/clientObservables";

// Typing stops this long after the field last changed, so that a line left half written isn't being typed for good.
const TYPING_IDLE_MS = 10_000;

const state = {focused: false, written: false, changedAt: -Infinity,
    timer: undefined as ReturnType<typeof setTimeout> | undefined};

// Whether the user is typing a line in the chat (chatTypingObservable): its field focused, something written in it, and
// changed lately. The helper the line would be for stands waiting on them meanwhile (see HelperBehaviorUtil.waitFor).
const ChatTypingUtil =
{
    // The field taken, or left.
    focus: (focused: boolean): void =>
    {
        state.focused = focused;
        refresh();
    },
    // What the field holds as it changes, as typed (an IME composition included) or cleared once sent.
    change: (text: string): void =>
    {
        state.written = text.trim().length > 0;
        state.changedAt = Date.now();
        refresh();
    },
}

function refresh(): void
{
    clearTimeout(state.timer);
    const idle = Date.now() - state.changedAt;
    const typing = state.focused && state.written && idle < TYPING_IDLE_MS;
    if (typing)
        state.timer = setTimeout(refresh, TYPING_IDLE_MS - idle);
    if (typing != chatTypingObservable.peek())
        chatTypingObservable.set(typing);
}

export default ChatTypingUtil;
