// Ambient types for CloseWatcher (not yet in TypeScript's DOM lib): Escape or Android Back, reported
// once before it becomes a history navigation.

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
