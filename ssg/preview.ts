// Shows the site on this computer (`npm run preview`, at http://127.0.0.1:3400 unless a port is given). A page is
// built again whenever a source, a template or the generator has changed since the last build, so reloading the
// browser shows an edit. Also shows the page the site's styles are tried on, at /test-ui.
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import EJSUtil from "./util/ejsUtil.ts";
import { SOURCE_FILE_NAME } from "./util/fileUtil.ts";
import { ArcadeData } from "./data/arcadeData.ts";
import { PUBLIC_DIR, URL_STATIC, VIEWS_DIR } from "./siteConstants.ts";

// Clear of the game's dev server and its editors (3000 to 3300).
const DEFAULT_PORT = 3400;
const GENERATOR_DIR = import.meta.dirname;
const TEST_UI_PATH = "/test-ui";

// Share metadata and the analytics tag, which only the published site carries.
const PROD_CODE_BLOCK_PATTERN = /PROD_CODE_BEGIN[\s\S]*?PROD_CODE_END/g;

const CONTENT_TYPES: {[extension: string]: string} = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".xml": "application/xml",
    ".atom": "application/atom+xml",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
};

let lastBuildTime = 0;
let building: Promise<void> | undefined;

// When anything a build reads was last changed: the generator's code, the templates and the sources.
function getNewestInputTime(): number
{
    let newest = 0;
    const visit = (dir: string, extension: string): void => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true}))
        {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory())
            {
                if (entry.name != "node_modules")
                    visit(entryPath, extension);
            }
            else if (entry.name.endsWith(extension))
                newest = Math.max(newest, fs.statSync(entryPath).mtimeMs);
        }
    };
    visit(GENERATOR_DIR, ".ts");
    visit(VIEWS_DIR, ".ejs");
    for (const entry of fs.readdirSync(PUBLIC_DIR, {withFileTypes: true}))
    {
        const sourcePath = path.join(PUBLIC_DIR, entry.name, SOURCE_FILE_NAME);
        if (entry.isDirectory() && fs.existsSync(sourcePath))
            newest = Math.max(newest, fs.statSync(sourcePath).mtimeMs);
    }
    return newest;
}

// Runs the build as its own process, so that it reads the generator's code as it is now.
async function rebuildIfStale(): Promise<void>
{
    if (building == undefined && getNewestInputTime() > lastBuildTime)
    {
        const startTime = Date.now();
        building = promisify(execFile)(process.execPath, [path.join(GENERATOR_DIR, "build.ts")])
            .then(() => { lastBuildTime = startTime; })
            .finally(() => { building = undefined; });
    }
    await building;
}

function postProcessHTML(html: string, origin: string): string
{
    return html.replace(PROD_CODE_BLOCK_PATTERN, "REMOVED_PROD_CODE").replaceAll(URL_STATIC, origin);
}

function send(res: http.ServerResponse, status: number, contentType: string, body: string | Buffer): void
{
    res.writeHead(status, {"content-type": contentType, "cache-control": "no-store"});
    res.end(body);
}

// `rebuild: false` shows the pages as they are, building nothing.
export function createPreviewServer(options: {rebuild?: boolean} = {}): http.Server
{
    return http.createServer(async (req, res) => {
        try
        {
            const origin = `http://${req.headers.host}`;
            let requestPath = decodeURIComponent(new URL(req.url ?? "/", origin).pathname);
            if (requestPath.endsWith("/"))
                requestPath += "index.html";

            if (requestPath == TEST_UI_PATH)
            {
                const html = await EJSUtil.createStaticHTMLFromEJS("page/development/test_ui.ejs",
                    {gameEntries: ArcadeData.gameEntries});
                send(res, 200, CONTENT_TYPES[".html"], postProcessHTML(html, origin));
                return;
            }

            const filePath = path.join(PUBLIC_DIR, requestPath);
            const isPage = filePath.endsWith(".html");
            if (isPage && options.rebuild != false)
                await rebuildIfStale();

            // Nothing outside the site's folder, and nothing the site doesn't publish as a file.
            if (!filePath.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
            {
                send(res, 404, "text/plain; charset=utf-8", `Not found: ${requestPath}`);
                return;
            }
            if (isPage)
                send(res, 200, CONTENT_TYPES[".html"], postProcessHTML(fs.readFileSync(filePath, "utf8"), origin));
            else
                send(res, 200, CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
                    fs.readFileSync(filePath));
        }
        catch (err: any)
        {
            // A build that failed says why on its error output.
            send(res, 500, "text/plain; charset=utf-8", String(err?.stderr || err?.stack || err));
        }
    });
}

if (path.resolve(process.argv[1] ?? "") == import.meta.filename)
{
    const port = Number(process.argv[2] ?? DEFAULT_PORT);
    createPreviewServer().listen(port, "127.0.0.1", () => {
        console.log(`The site is shown at http://127.0.0.1:${port} (its style test page at ${TEST_UI_PATH}). Ctrl+C stops it.`);
    });
}
