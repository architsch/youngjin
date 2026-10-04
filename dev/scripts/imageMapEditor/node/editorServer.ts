import fs from "fs";
import path from "path";
import http from "http";
import EntryStore from "./entryStore";
import ConflictError from "./conflictError";
import RequestError from "./requestError";
import MapRebuilder from "./mapRebuilder";
import SourcePreprocessor from "./sourcePreprocessor";
import MissingToolsError from "./missingToolsError";
import SaveEntryRequest from "../core/saveEntryRequest";
import SourcePrep from "../core/sourcePrep";

// Loopback only: the server writes into the repository.
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 128 * 1024 * 1024;
const SSE_KEEPALIVE_MS = 25000;
// Editors save by truncating then writing, or by replacing the file, each of which fires several events.
const WATCH_DEBOUNCE_MS = 100;

const STATIC_FILES: {[pathname: string]: {fileName: string, contentType: string}} = {
    "/": {fileName: "index.html", contentType: "text/html; charset=utf-8"},
    "/editor.css": {fileName: "editor.css", contentType: "text/css; charset=utf-8"},
};

// The page (bundled here in memory from app/, and rebuilt whenever a file it imports changes, which reloads it)
// and the API it edits the map through. Events tell the page about a new bundle, a change on disk, and each
// finished rebuild of the map.
export default async function serveEditor(store: EntryStore, port: number): Promise<void>
{
    const toolDir = path.join(store.paths.repoRoot, "dev/scripts/imageMapEditor");
    const eventStreams = new Set<http.ServerResponse>();
    const broadcast = (eventName: string, data: object) => {
        for (const res of eventStreams)
            res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const mapRebuilder = new MapRebuilder(store.paths, (error) => {
        if (error)
            console.error(`Rebuilding the map failed:\n${error}`);
        else
            console.log(`Map rebuilt (${new Date().toLocaleTimeString()})`);
        broadcast("map", {error: error ?? null});
    });
    const preprocessor = new SourcePreprocessor(store.library, store.paths.repoRoot);

    // The page's script, and its previews' worker (see app/previewWorker.ts).
    let bundle = {code: "", workerCode: "", ok: false};
    let resolveFirstBundle: () => void = () => {};
    const firstBundle = new Promise<void>((resolve) => resolveFirstBundle = resolve);
    const esbuild = await import("esbuild");
    const buildContext = await esbuild.context({
        entryPoints: {"editor": path.join(toolDir, "app/main.tsx"),
            "preview-worker": path.join(toolDir, "app/previewWorker.ts")},
        outdir: toolDir, // never written (write: false)
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2020",
        jsx: "automatic",
        sourcemap: "inline",
        // React's development build logs every prop of a render to the performance timeline, walking the pixel
        // buffers the previews pass as props: hundreds of milliseconds a render.
        define: {"process.env.NODE_ENV": JSON.stringify("production")},
        logLevel: "silent",
        plugins: [{name: "serve-in-memory", setup: (build) => build.onEnd((result) => {
            if (result.errors.length > 0)
            {
                const message = esbuild.formatMessagesSync(result.errors, {kind: "error", color: false}).join("\n");
                console.error(message);
                bundle = {code: `document.body.innerHTML = "<pre class='bundle-error'></pre>";`
                    + `document.querySelector(".bundle-error").textContent = ${JSON.stringify("The editor failed to bundle:\n\n" + message)};`
                    + `new EventSource("/api/events").addEventListener("bundle", () => location.reload());`,
                    workerCode: "", ok: false};
            }
            else
            {
                const outputOf = (name: string) => result.outputFiles!.find(file => path.basename(file.path) == name)!.text;
                bundle = {code: outputOf("editor.js"), workerCode: outputOf("preview-worker.js"), ok: true};
                console.log(`Editor bundled (${new Date().toLocaleTimeString()})`);
            }
            resolveFirstBundle();
            broadcast("bundle", {});
        })}],
    });
    await buildContext.watch();
    watchState(store, () => broadcast("state", {hash: store.readState().hash}));

    const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        // Rejects pages on other origins reaching this server through a rebound DNS name.
        if (req.headers.host !== `${HOST}:${port}` && req.headers.host !== `localhost:${port}`)
            return sendText(res, 403, "Forbidden host");

        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const staticFile = STATIC_FILES[url.pathname];
        if (req.method === "GET" && staticFile)
        {
            res.writeHead(200, {"Content-Type": staticFile.contentType, "Cache-Control": "no-store"});
            return res.end(fs.readFileSync(path.join(toolDir, staticFile.fileName)));
        }
        if (req.method === "GET" && (url.pathname === "/editor.js" || url.pathname === "/preview-worker.js"))
        {
            await firstBundle;
            res.writeHead(200, {"Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store"});
            return res.end(url.pathname === "/editor.js" ? bundle.code : bundle.workerCode);
        }
        if (req.method === "GET" && url.pathname === "/api/events")
        {
            res.writeHead(200, {"Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive"});
            res.write(": connected\n\n");
            const keepalive = setInterval(() => res.write(": keepalive\n\n"), SSE_KEEPALIVE_MS);
            eventStreams.add(res);
            req.on("close", () => {
                clearInterval(keepalive);
                eventStreams.delete(res);
            });
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/state")
            return sendJSON(res, 200, store.readState());

        // A JSON body can't be sent cross-origin without a preflight, which this server never answers.
        if (req.method === "PUT" && url.pathname === "/api/entries")
        {
            if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
                return sendText(res, 415, "Expected application/json");
            const request = JSON.parse((await readBody(req)).toString("utf8")) as SaveEntryRequest;
            const entryPath = await store.saveEntry(request);
            mapRebuilder.request();
            return sendJSON(res, 200, {path: entryPath, state: store.readState()});
        }
        if (req.method === "DELETE" && url.pathname === "/api/entries")
        {
            store.deleteEntry(url.searchParams.get("path") ?? "", url.searchParams.get("baseHash") ?? "");
            mapRebuilder.request();
            return sendJSON(res, 200, {state: store.readState()});
        }

        // The source library (see SourceLibrary): a photo added from the page as its bytes, or by its address.
        if (req.method === "POST" && url.pathname === "/api/sources")
        {
            if (req.headers["content-type"] !== "application/octet-stream")
                return sendText(res, 415, "Expected application/octet-stream");
            const fileName = decodeURIComponent(String(req.headers["x-file-name"] ?? "source"));
            const added = await store.library.add(await readBody(req), fileName);
            broadcast("state", {});
            return sendJSON(res, 200, added);
        }
        if (req.method === "POST" && url.pathname === "/api/sources/download")
        {
            if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
                return sendText(res, 415, "Expected application/json");
            const {source} = JSON.parse((await readBody(req)).toString("utf8")) as {source: string};
            const added = await store.library.addFromUrl(source);
            broadcast("state", {});
            return sendJSON(res, 200, added);
        }
        // A source preprocessed into another (see SourcePreprocessor): previewed, or added to the library.
        const preparedMatch = /^\/api\/sources\/([0-9a-f]{40})\/prepared(\/preview)?$/.exec(url.pathname);
        if (req.method === "POST" && preparedMatch)
        {
            if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
                return sendText(res, 415, "Expected application/json");
            const {prep, fetchTools} = JSON.parse((await readBody(req)).toString("utf8")) as
                {prep: SourcePrep, fetchTools?: boolean};
            if (preparedMatch[2])
                return sendJSON(res, 200, await preprocessor.preview(preparedMatch[1], prep, fetchTools === true));
            const added = await preprocessor.add(preparedMatch[1], prep, fetchTools === true);
            broadcast("state", {});
            return sendJSON(res, 200, added);
        }
        const sourceMatch = /^\/api\/sources\/([0-9a-f]{40})(\/thumbnail)?$/.exec(url.pathname);
        if (req.method === "GET" && sourceMatch && sourceMatch[2])
        {
            const thumbnail = await store.library.getThumbnail(sourceMatch[1]);
            if (thumbnail == undefined)
                return sendText(res, 404, "Not on this machine");
            res.writeHead(200, {"Content-Type": "image/webp", "Cache-Control": "no-store"});
            return res.end(thumbnail);
        }
        if (req.method === "GET" && sourceMatch)
        {
            const sourcePath = store.library.findFile(sourceMatch[1]);
            if (sourcePath == undefined)
                return sendText(res, 404, "Not on this machine");
            // Opened to be edited, so decoded ahead of the save that renders from it.
            store.library.decode(sourceMatch[1]).catch(() => {});
            return sendFile(res, sourcePath, "application/octet-stream");
        }
        if (req.method === "DELETE" && sourceMatch && !sourceMatch[2])
        {
            const recipes = store.readState().recipeFile.recipes;
            store.library.delete(sourceMatch[1],
                Object.keys(recipes).filter(entryPath => recipes[entryPath].sourceSha1 == sourceMatch[1]));
            broadcast("state", {});
            return sendJSON(res, 200, {state: store.readState()});
        }

        // An entry's game image or full-resolution sample.
        const fileMatch = /^\/api\/(images|samples)\/(\w+\/\w+)\.webp$/.exec(url.pathname);
        if (req.method === "GET" && fileMatch)
        {
            const filePath = (fileMatch[1] == "images") ? store.findGameImage(fileMatch[2]) : store.getSamplePath(fileMatch[2]);
            return (filePath != undefined && fs.existsSync(filePath)) ? sendFile(res, filePath, "image/webp")
                : sendText(res, 404, "No such file");
        }
        return sendText(res, 404, "Not found");
    };

    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
            if (err instanceof ConflictError)
                return sendJSON(res, 409, {state: err.state});
            if (err instanceof RequestError)
                return sendText(res, 400, err.message);
            // Asked again with leave to fetch them, if the page's user gives it.
            if (err instanceof MissingToolsError)
                return sendText(res, 428, err.message);
            console.error(err);
            if (!res.headersSent)
                sendText(res, 500, err instanceof Error ? err.message : String(err));
        });
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE")
            console.error(`Port ${port} is in use. Pass another one: npm run imageMapEditor -- --port <port>`);
        else
            console.error(err);
        process.exit(1);
    });
    server.listen(port, HOST, () => {
        console.log(`Image map editor: http://${HOST}:${port}`);
        console.log(`Editing ${store.readState().manifestPath}. Stop with Ctrl+C.`);
    });

    const shutDown = () => {
        Promise.allSettled([buildContext.dispose(), preprocessor.release()]).finally(() => process.exit(0));
    };
    process.on("SIGINT", shutDown);
    process.on("SIGTERM", shutDown);
}

// The directories are watched, not the files, since an editor that saves by replacing a file ends a watch on it.
function watchState(store: EntryStore, onChanged: () => void): void
{
    let lastHash = store.readState().hash;
    let debounceTimer: NodeJS.Timeout | undefined;
    const onEvent = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            let hash: string;
            try
            {
                hash = store.readState().hash;
            }
            catch
            {
                return; // Mid-replace; the write that completes it fires again.
            }
            if (hash === lastHash)
                return;
            lastHash = hash;
            onChanged();
        }, WATCH_DEBOUNCE_MS);
    };
    fs.watch(store.paths.imagesDir, (_eventType, fileName) => {
        if (fileName === "manifest.json")
            onEvent();
    });
    if (fs.existsSync(path.dirname(store.paths.recipesPath)))
    {
        fs.watch(path.dirname(store.paths.recipesPath), (_eventType, fileName) => {
            if (fileName === path.basename(store.paths.recipesPath))
                onEvent();
        });
    }
}

function readBody(req: http.IncomingMessage): Promise<Buffer>
{
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES)
            {
                reject(new Error("Body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function sendJSON(res: http.ServerResponse, status: number, body: object): void
{
    res.writeHead(status, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
    res.end(JSON.stringify(body));
}

function sendFile(res: http.ServerResponse, filePath: string, contentType: string): void
{
    res.writeHead(200, {"Content-Type": contentType, "Cache-Control": "no-store"});
    res.end(fs.readFileSync(filePath));
}

function sendText(res: http.ServerResponse, status: number, text: string): void
{
    res.writeHead(status, {"Content-Type": "text/plain; charset=utf-8"});
    res.end(text);
}
