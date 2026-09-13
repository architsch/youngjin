// Debounce window: one save per slider drag, yet saved before a quick form close.
const SAVE_INTERVAL_MS = 2000;

// A debounced save that runs at most every interval with the latest arguments and reads live state at
// write time. The state is in the closure, so a save still fires after the form closes.
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
