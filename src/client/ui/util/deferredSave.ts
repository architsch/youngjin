// How long an edit is allowed to sit before it is written down. Long enough that dragging a slider
// or working through a row of colors is one save rather than dozens, short enough that a user who
// closes the form straight after an edit has already had it saved.
const SAVE_INTERVAL_MS = 2000;

// A save that is asked for as often as the user edits, and actually performed once every couple of
// seconds.
//
// **The save reads the live state rather than being handed it**, which is the whole reason this is
// a deferral rather than a queue: what should be written down is whatever the thing being edited
// looks like when the writing happens, not what it looked like at the edit that happened to arm the
// timer. Any arguments given are the most recent ones, for the same reason.
//
// The state lives in the closure this returns rather than in a component, so that it survives the
// form being re-rendered — and being closed, which is the case that matters: an edit made a moment
// before the form was put away is still written down.
export default function createDeferredSave<TArgs extends unknown[]>(
    save: (...args: TArgs) => void): (...args: TArgs) => void
{
    let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
    let pendingArgs: TArgs;

    return (...args: TArgs) => {
        pendingArgs = args;
        if (pendingTimeout != undefined)
            return;
        pendingTimeout = setTimeout(() => {
            pendingTimeout = undefined;
            save(...pendingArgs);
        }, SAVE_INTERVAL_MS);
    };
}
