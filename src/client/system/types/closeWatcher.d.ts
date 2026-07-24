// Ambient declaration for the CloseWatcher API, which TypeScript's DOM library does not carry yet.
// A CloseWatcher hears the platform's "close request" — the Escape key on a keyboard, and the Back
// button or back gesture on Android — and reports it as one event, claiming it before the browser
// would have turned it into a history navigation. A watcher is spent by the request it reports.

interface CloseWatcher extends EventTarget
{
    onclose: ((this: CloseWatcher, ev: Event) => any) | null;
    oncancel: ((this: CloseWatcher, ev: Event) => any) | null;
    requestClose(): void;
    close(): void;
    destroy(): void;
}

declare var CloseWatcher: {
    prototype: CloseWatcher;
    new (options?: { signal?: AbortSignal }): CloseWatcher;
};
