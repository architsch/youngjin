// Debounce window: one save per slider drag, yet saved before a quick form close.
const SAVE_INTERVAL_MS = 2000;

// A debounced save that runs at most every interval with the latest arguments and reads live state at
// write time. The state is in the closure, so a save still fires after the form closes. Only the latest
// arguments are kept, so a call for another target (see getTarget) first saves the pending one.
export default function createDeferredSave<TArgs extends unknown[]>(
    save: (...args: TArgs) => void,
    getTarget: (...args: TArgs) => unknown = () => undefined): (...args: TArgs) => void
{
    let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
    let pendingArgs: TArgs;

    const savePending = () => {
        clearTimeout(pendingTimeout);
        pendingTimeout = undefined;
        save(...pendingArgs);
    };

    return (...args: TArgs) => {
        if (pendingTimeout != undefined && getTarget(...args) !== getTarget(...pendingArgs))
            savePending();
        pendingArgs = args;
        if (pendingTimeout != undefined)
            return;
        pendingTimeout = setTimeout(savePending, SAVE_INTERVAL_MS);
    };
}
