// Local server for the pre-encoded composition editor: a page that edits pre_encoding_source.json and
// redraws its entries' thumbnails as they change, through the same encoder and renderer the build uses
// (see app/). The page is bundled here in memory, so nothing of it reaches the client or server bundles;
// the bundle is rebuilt whenever a file it imports changes, and the open page reloads with its edits kept.
//
// Usage: npm run compositionEditor [-- --port <port>] [-- --source <path to a copy to edit instead>]

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const REPO_ROOT = path.join(__dirname, "../../..");
const SOURCE_FILE_PATH = path.resolve(readArg("--source")
    ?? path.join(REPO_ROOT, "public/app/assets/instanced_mesh_composition/pre_encoding_source.json"));
const APP_ENTRY_PATH = path.join(__dirname, "app/main.tsx");
const STATIC_FILES = {
    "/": { fileName: "index.html", contentType: "text/html; charset=utf-8" },
    "/editor.css": { fileName: "editor.css", contentType: "text/css; charset=utf-8" },
};

// Loopback only: the server writes into the repository.
const HOST = "127.0.0.1";
const DEFAULT_PORT = 3100;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const SSE_KEEPALIVE_MS = 25000;
// Editors save by truncating then writing, or by replacing the file, each of which fires several events.
const SOURCE_WATCH_DEBOUNCE_MS = 100;

const port = readPortArg();
const eventStreams = new Set();
let bundle = { code: "", ok: false };
let resolveFirstBundle;
const firstBundle = new Promise((resolve) => { resolveFirstBundle = resolve; });

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

async function main()
{
    let esbuild;
    try
    {
        esbuild = require("esbuild");
    }
    catch
    {
        console.error("esbuild was not found. It comes with the dev dependencies (through vitest): run `npm install`.");
        process.exit(1);
    }

    const buildContext = await esbuild.context({
        entryPoints: [APP_ENTRY_PATH],
        outfile: path.join(__dirname, "editor.js"), // never written (write: false)
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2020",
        jsx: "automatic",
        sourcemap: "inline",
        define: { "process.env.NODE_ENV": JSON.stringify("development") },
        logLevel: "silent",
        plugins: [{ name: "serve-in-memory", setup: (build) => build.onEnd((result) => onBundled(esbuild, result)) }],
    });
    await buildContext.watch();
    watchSourceFile();

    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
            console.error(err);
            if (!res.headersSent)
                res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(String(err));
        });
    });
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE")
            console.error(`Port ${port} is in use. Pass another one: npm run compositionEditor -- --port <port>`);
        else
            console.error(err);
        process.exit(1);
    });
    server.listen(port, HOST, () => {
        console.log(`Composition editor: http://${HOST}:${port}`);
        console.log(`Editing ${getDisplayPath()}. Stop with Ctrl+C.`);
    });

    const shutDown = () => {
        buildContext.dispose().finally(() => process.exit(0));
    };
    process.on("SIGINT", shutDown);
    process.on("SIGTERM", shutDown);
}

function onBundled(esbuild, result)
{
    if (result.errors.length > 0)
    {
        const message = esbuild.formatMessagesSync(result.errors, { kind: "error", color: false }).join("\n");
        console.error(message);
        bundle = { code: getErrorPageScript(message), ok: false };
    }
    else
    {
        bundle = { code: result.outputFiles[0].text, ok: true };
        console.log(`Editor bundled (${new Date().toLocaleTimeString()})`);
    }
    resolveFirstBundle();
    broadcast("bundle", {});
}

// Shown in place of the editor, so a broken import is seen where the tool is being used.
function getErrorPageScript(message)
{
    return `document.body.innerHTML = "<pre class='bundle-error'></pre>";
document.querySelector(".bundle-error").textContent = ${JSON.stringify("The editor failed to bundle:\n\n" + message)};
new EventSource("/api/events").addEventListener("bundle", () => location.reload());`;
}

async function handleRequest(req, res)
{
    // Rejects pages on other origins reaching this server through a rebound DNS name.
    if (req.headers.host !== `${HOST}:${port}` && req.headers.host !== `localhost:${port}`)
        return sendText(res, 403, "Forbidden host");

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const staticFile = STATIC_FILES[pathname];

    if (req.method === "GET" && staticFile)
    {
        // Read on every request, so an edit to the page shows on reload.
        const content = fs.readFileSync(path.join(__dirname, staticFile.fileName));
        res.writeHead(200, { "Content-Type": staticFile.contentType, "Cache-Control": "no-store" });
        return res.end(content);
    }
    if (req.method === "GET" && pathname === "/editor.js")
    {
        await firstBundle;
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(bundle.code);
    }
    if (req.method === "GET" && pathname === "/api/source")
        return sendJSON(res, 200, { ...readSource(), path: getDisplayPath() });
    if (req.method === "PUT" && pathname === "/api/source")
        return saveSource(req, res);
    if (req.method === "GET" && pathname === "/api/events")
        return openEventStream(req, res);
    return sendText(res, 404, "Not found");
}

// Refused if the file changed since the page last read it, so an edit made elsewhere is never overwritten
// unseen; the page is sent the current file to decide with.
async function saveSource(req, res)
{
    // A JSON body can't be sent cross-origin without a preflight, which this server never answers.
    if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
        return sendText(res, 415, "Expected application/json");

    let text, baseHash;
    try
    {
        ({ text, baseHash } = JSON.parse(await readBody(req)));
        if (typeof text !== "string" || !Array.isArray(JSON.parse(text).compositions))
            throw new Error("The text is not a composition source");
    }
    catch (err)
    {
        return sendText(res, 400, `Bad request: ${err.message}`);
    }

    const current = readSource();
    if (current.hash !== baseHash)
        return sendJSON(res, 409, current);

    fs.writeFileSync(SOURCE_FILE_PATH, text);
    return sendJSON(res, 200, { hash: getHash(text) });
}

function openEventStream(req, res)
{
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive" });
    res.write(": connected\n\n");
    const keepalive = setInterval(() => res.write(": keepalive\n\n"), SSE_KEEPALIVE_MS);
    eventStreams.add(res);
    req.on("close", () => {
        clearInterval(keepalive);
        eventStreams.delete(res);
    });
}

function broadcast(eventName, data)
{
    for (const res of eventStreams)
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

// The directory is watched, not the file, since an editor that saves by replacing the file ends a
// watch on the old one.
function watchSourceFile()
{
    let lastHash = readSource().hash;
    let debounceTimer;
    fs.watch(path.dirname(SOURCE_FILE_PATH), (eventType, fileName) => {
        if (fileName && fileName !== path.basename(SOURCE_FILE_PATH))
            return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            let hash;
            try
            {
                hash = readSource().hash;
            }
            catch
            {
                return; // Mid-replace; the write that completes it fires again.
            }
            if (hash === lastHash)
                return;
            lastHash = hash;
            broadcast("source", { hash });
        }, SOURCE_WATCH_DEBOUNCE_MS);
    });
}

function readSource()
{
    const text = fs.readFileSync(SOURCE_FILE_PATH, "utf8");
    return { text, hash: getHash(text) };
}

// Relative to the repository when inside it.
function getDisplayPath()
{
    const relativePath = path.relative(REPO_ROOT, SOURCE_FILE_PATH);
    return relativePath.startsWith("..") ? SOURCE_FILE_PATH : relativePath;
}

function getHash(text)
{
    return crypto.createHash("sha1").update(text).digest("hex");
}

function readBody(req)
{
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES)
            {
                reject(new Error("Body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function sendJSON(res, status, body)
{
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
}

function sendText(res, status, text)
{
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(text);
}

function readPortArg()
{
    const arg = readArg("--port");
    if (arg == undefined)
        return DEFAULT_PORT;
    const value = Number(arg);
    if (!Number.isInteger(value) || value <= 0 || value > 65535)
    {
        console.error(`Invalid --port value: ${arg}`);
        process.exit(1);
    }
    return value;
}

function readArg(flag)
{
    const flagIndex = process.argv.indexOf(flag);
    return flagIndex < 0 ? undefined : process.argv[flagIndex + 1];
}
