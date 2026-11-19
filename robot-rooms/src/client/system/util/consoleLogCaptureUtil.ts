// In-memory rolling copy of console output, readable in-app via the "log" debug command (for devices
// without a console). Loaded first (see @src/client/client.ts) and forwards every call unchanged.
// Resets on page load: if the oldest entries are start-up messages, the page reloaded; if hours old,
// it was suspended and resumed.
const ConsoleLogCaptureUtil =
{
    // Everything captured so far, as one block of text, oldest entry first.
    getText: (): string =>
    {
        return entries.join("\n");
    },
    // Changes when the text changes; viewers poll it instead of being notified per console call.
    getRevision: (): number =>
    {
        return revision;
    },
    clear: (): void =>
    {
        entries.length = 0;
        totalCharacters = 0;
        revision++;
    },
}

// Captured methods and their labels (padded for column alignment).
const levelLabels: {[method: string]: string} = {
    log: "LOG",
    info: "INF",
    warn: "WRN",
    error: "ERR",
    debug: "DBG",
};

// Total and per-entry caps: bound memory, and stop one huge dump from evicting everything.
const maxTotalCharacters = 20000;
const maxEntryCharacters = 1000;

const entries: string[] = [];
let totalCharacters = 0;
let revision = 0;

// Prevents recursion if formatting triggers another console call.
let capturing = false;

function install(): void
{
    const consoleMethods = console as unknown as {[method: string]: (...args: unknown[]) => void};
    for (const method of Object.keys(levelLabels))
    {
        const originalMethod = consoleMethods[method];
        if (typeof originalMethod !== "function")
            continue;
        consoleMethods[method] = function (...args: unknown[]): void {
            originalMethod.apply(console, args);
            append(levelLabels[method], args);
        };
    }

    // Uncaught errors and rejections bypass the console methods, so capture them from events.
    window.addEventListener("error", (event: ErrorEvent) => {
        append(levelLabels["error"], [event.error != undefined ? event.error : event.message]);
    });
    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
        append(levelLabels["error"], ["Unhandled promise rejection:", event.reason]);
    });
}

function append(label: string, args: unknown[]): void
{
    if (capturing)
        return;
    capturing = true;
    try
    {
        let entry = `${getTimestamp()} [${label}] ${formatArgs(args)}`;
        if (entry.length > maxEntryCharacters)
            entry = `${entry.slice(0, maxEntryCharacters)}... (truncated)`;

        entries.push(entry);
        totalCharacters += entry.length + 1; // +1 for the newline joining it to the entry before it

        // Evict oldest first; never the last entry, so the record can't go empty.
        while (totalCharacters > maxTotalCharacters && entries.length > 1)
            totalCharacters -= entries.shift()!.length + 1;

        revision++;
    }
    catch (err)
    {
        // A record of the console must never be the reason a call to the console fails.
    }
    finally
    {
        capturing = false;
    }
}

// Wall-clock time, so gaps from backgrounding are visible.
function getTimestamp(): string
{
    const now = new Date();
    return `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}:` +
        `${pad(now.getSeconds(), 2)}.${pad(now.getMilliseconds(), 3)}`;
}

function pad(value: number, length: number): string
{
    return value.toString().padStart(length, "0");
}

function formatArgs(args: unknown[]): string
{
    const parts: string[] = [];
    for (const arg of args)
        parts.push(formatArg(arg));
    return parts.join(" ");
}

function formatArg(arg: unknown): string
{
    if (typeof arg === "string")
        return arg;
    if (arg instanceof Error)
        return arg.stack != undefined ? arg.stack : `${arg.name}: ${arg.message}`;
    if (arg == undefined || typeof arg !== "object")
        return String(arg);
    try
    {
        const serialized = JSON.stringify(arg);
        return serialized != undefined ? serialized : String(arg);
    }
    catch (err)
    {
        return String(arg); // e.g. a value the serializer cannot walk, such as a circular one
    }
}

install();

export default ConsoleLogCaptureUtil;
