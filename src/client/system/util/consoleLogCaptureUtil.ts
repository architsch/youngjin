// A rolling, in-memory copy of everything the page writes to the browser console, kept so that a
// problem which only shows up on a device with no console attached — a phone, most of the time —
// can still be read back from inside the app itself. The "log" debug command opens a view onto it.
//
// The capture is installed as this module is loaded, and this module is loaded before anything else
// the client does (see @src/client/client.ts), so the record starts at the very beginning of the
// page's life. It only observes: every captured call is still forwarded to the console method it
// came from, unchanged, so the browser's own console reads exactly as it otherwise would.
//
// The record lives in memory, and therefore starts over on every page load — which is itself worth
// reading. A record whose oldest entries are the app's own start-up messages says the page was
// re-loaded; one whose oldest entries are hours old says the page was merely suspended and resumed.
const ConsoleLogCaptureUtil =
{
    // Everything captured so far, as one block of text, oldest entry first.
    getText: (): string =>
    {
        return entries.join("\n");
    },
    // Changes whenever the captured text changes. A viewer compares this against what it last drew
    // to decide whether there is anything new to draw — which is cheaper, and far less prone to
    // feeding back on itself, than being notified once per console call.
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

// The console methods that are copied, and how each one is labelled in the record. Labels are
// padded to the same width so that the text of the entries themselves lines up in a column.
const levelLabels: {[method: string]: string} = {
    log: "LOG",
    info: "INF",
    warn: "WRN",
    error: "ERR",
    debug: "DBG",
};

// How much text the record is allowed to hold in total, and how much of it any single entry may
// account for. The first is what keeps a page left open for hours from growing without bound; the
// second stops one enormous dump (a decoded signal, a deep object) from evicting everything else.
const maxTotalCharacters = 20000;
const maxEntryCharacters = 1000;

const entries: string[] = [];
let totalCharacters = 0;
let revision = 0;

// Guards against a capture that ends up logging something itself — via a property getter reached
// while formatting, say — from recursing back into the console it is in the middle of copying.
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

    // Uncaught errors and rejected promises reach the console without passing through any of the
    // methods above, and they are the entries most worth having, so they are taken from the events
    // the page fires for them instead.
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

        // Oldest out first, so that what survives the cap is the newest output — the part someone
        // troubleshooting is actually looking at. The last entry is never evicted, however long it
        // is, so that the record can never end up empty while output is still arriving.
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

// Wall-clock time rather than time since the page loaded: the gap it leaves across a spell in the
// background is the very thing this record exists to make visible.
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
