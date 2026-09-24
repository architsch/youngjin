/**
 * Local playtest runner: boots Chromium against a running local dev server, opens the SANDBOX, and either
 * runs a script from a file or holds a session open to be driven one step at a time. Unlike runPlan.js
 * (which drives the deployed staging server through a fixed action list), this is for trying something out
 * in a room built for the purpose.
 *
 * Usage:
 *   node dev/scripts/playtest/sandboxRunner.js --serve                    (hold it open; see below)
 *   node dev/scripts/playtest/sandboxRunner.js --serve --admin            (as an admin)
 *   node dev/scripts/playtest/sandboxRunner.js <script.js> [--out=dir] [--headed]
 *   node dev/scripts/playtest/sandboxRunner.js --probe                    (boot + dump the UI)
 *   node dev/scripts/playtest/sandboxRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]
 *
 * Runs open in the sandbox by default: an empty single-player room with a free camera, where sets are
 * built on request (see AutomationSetupUtil's sandbox group). `--fresh-room` (or `freshRoom: true`) opens a
 * generated room from a fixed seed instead, for what the sandbox cannot host — room generation itself, and
 * flows that need a stored, multiplayer room. `--admin` opens either as an admin.
 *
 * Expects a dev server already up (`npm run devnossg`) and never starts one, so it can't take down a
 * server in use.
 *
 * Environment:
 *   SANDBOX_BASE_URL   address of the dev server (default http://127.0.0.1:3000)
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const { seedFreshRoom, removeFreshRoom } = require("./lib/freshRoom");
const Interact = require("../lib/interact");
const Setup = require("../lib/setup");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const BASE_URL = (process.env.SANDBOX_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
// Git-ignored, so nothing a run photographs reaches a commit.
const DEFAULT_OUT_DIR = "test-results/sandbox";

// Seeded dev users (see DevUserSeedUtil): 1-3 are members, 4 is the admin.
const DEV_USER_MEMBER = 1;
const DEV_USER_ADMIN = 4;

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const JPEG_QUALITY = 88;

const TIMEOUT_SOCKET_MS = 20_000;
const TIMEOUT_ROOM_MS = 45_000;

// Where a session listens when --serve is given no port of its own.
const DEFAULT_SERVE_PORT = 4321;

// Matched only inside the app's UI root, so the page's boot indicator can't satisfy the wait (as in
// tests/e2e/helpers/constants.ts).
const LOADING_INDICATOR_TEXT = "Loading...";

// Tells the server this browser finished the tutorial. Local dev suffixes cookie names to avoid clashing
// with live sessions.
const TUTORIAL_FINISHED_COOKIE = "thingspool_tutorial_finished"
    + (/\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE_URL) ? "_dev" : "");

async function main()
{
    const args = process.argv.slice(2);
    const probeOnly = args.includes("--probe");
    const headed = args.includes("--headed");
    const freshRoomFlag = args.includes("--fresh-room");
    const sandboxFlag = args.includes("--sandbox");
    const adminFlag = args.includes("--admin");
    const serveArg = args.find(a => a == "--serve" || a.startsWith("--serve="));
    const servePort = serveArg == undefined ? 0
        : (serveArg.includes("=") ? Number(serveArg.split("=")[1]) : DEFAULT_SERVE_PORT);
    const outArg = args.find(a => a.startsWith("--out="));
    const seedArg = args.find(a => a.startsWith("--seed="));
    // Runs choose the room type on the command line: only hubs have two storeys and admin-managed doors.
    const roomTypeArg = args.find(a => a.startsWith("--room-type="));
    // Likewise the seat, for a generated room: the sandbox has seats of its own (see openGame).
    const devUserArg = args.find(a => a.startsWith("--devuser="));
    const scriptPath = args.find(a => !a.startsWith("--"));

    if (!scriptPath && !probeOnly && !serveArg)
    {
        console.error("Usage: node dev/scripts/playtest/sandboxRunner.js <script.js> [--out=dir] [--headed] [--admin]");
        console.error("       node dev/scripts/playtest/sandboxRunner.js --probe");
        console.error("       node dev/scripts/playtest/sandboxRunner.js --serve[=port]   (the sandbox, unless --fresh-room)");
        console.error("       node dev/scripts/playtest/sandboxRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]");
        process.exit(1);
    }

    const runScript = scriptPath ? require(path.resolve(REPO_ROOT, scriptPath)) : {};
    if (adminFlag)
        runScript.admin = true;
    if (devUserArg)
        runScript.devUser = Number(devUserArg.slice("--devuser=".length));
    if (roomTypeArg)
        runScript.roomType = roomTypeArg.slice("--room-type=".length);
    if (sandboxFlag)
        runScript.sandbox = true;
    if (freshRoomFlag)
        runScript.freshRoom = true;

    // Contradictory room requests.
    if (runScript.sandbox && runScript.freshRoom)
    {
        console.error("[sandbox] --sandbox and --fresh-room both decide which room to open, and " +
            "they disagree: the sandbox is an empty room a set is built in, a fresh room is one the " +
            "generator made. Pick one.");
        process.exit(1);
    }

    // The sandbox is the default; a generated room must be requested explicitly.
    if (runScript.sandbox == undefined)
        runScript.sandbox = !runScript.freshRoom;
    const freshRoom = runScript.freshRoom === true;
    // In a generated room the seat is a seeded dev user; an admin run takes the seeded admin.
    if (runScript.devUser == undefined)
        runScript.devUser = runScript.admin ? DEV_USER_ADMIN : DEV_USER_MEMBER;
    // Names every file the run writes, and the sandbox seat it opens under.
    const slug = runScript.slug
        || (scriptPath ? path.basename(scriptPath, path.extname(scriptPath))
            : (serveArg ? "session" : "probe"));

    if (scriptPath && !probeOnly && !serveArg && typeof runScript.run != "function")
    {
        console.error(`[sandbox] ${scriptPath} exports no run() function.`);
        process.exit(1);
    }

    const outDir = path.resolve(REPO_ROOT,
        outArg ? outArg.slice("--out=".length) : DEFAULT_OUT_DIR);
    fs.mkdirSync(outDir, { recursive: true });

    await assertServerIsUp();

    // A seeded room makes a script's coordinates reproducible across machines and runs; removed at the end.
    let seededRoom = null;
    if (freshRoom)
    {
        seededRoom = await seedFreshRoom({
            seed: seedArg ? Number(seedArg.slice("--seed=".length)) : undefined,
            devUser: runScript.devUser,
            // Two-storey work needs a hub (Regular rooms are one storey; see freshRoom.js).
            roomType: runScript.roomType,
        });
        console.log(`[sandbox] Seeded ${seededRoom.roomType == 0 ? "hub" : "regular"} room ` +
            `${seededRoom.roomID} from seed ${seededRoom.seed} ` +
            `(${seededRoom.voxelCount} voxels, ${seededRoom.objectCount} objects).`);
    }

    const browser = await chromium.launch({
        headless: !headed,
        // SwiftShader renders identically headless or headed, independent of the GPU (mirrors the E2E config).
        args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--hide-scrollbars", "--mute-audio"],
    });
    const context = await browser.newContext({
        viewport: runScript.viewport || DEFAULT_VIEWPORT,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
    });

    // Skipped unless the script sets `tutorial: true`.
    if (runScript.tutorial !== true)
        await context.addCookies([{ name: TUTORIAL_FINISHED_COOKIE, value: "1", url: BASE_URL }]);

    const page = await context.newPage();
    page.setDefaultTimeout(15_000);

    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(String(err)));
    page.on("console", msg => { if (msg.type() == "error") pageErrors.push(msg.text()); });

    const files = [];
    let exitCode = 0;

    try
    {
        await openGame(page, runScript, slug, seededRoom);
        await waitForGameReady(page);

        const ctx = makeContext({ page, outDir, slug, files, runScript });

        // The sandbox is single-player too; walking out of it would land in the hub.
        if (runScript.tutorial !== true && !runScript.sandbox)
            await leaveTutorial(page);
        if (runScript.sandbox)
            await parkPlayer(ctx);
        if (runScript.hideDebugUI !== false)
            await ctx.hideDebugUI();
        if (runScript.dismissPopups !== false)
            await ctx.dismissPopups();

        if (serveArg)
        {
            await serveSession(ctx, servePort, pageErrors);
        }
        else if (probeOnly)
        {
            console.log("[sandbox] --- visible UI ---");
            console.log(JSON.stringify(await ctx.describeUI(), null, 2));
            await ctx.shot("probe");
        }
        else
        {
            await runScript.run(ctx);
        }
    }
    catch (err)
    {
        exitCode = 1;
        console.error(`[sandbox] Run failed: ${err && err.message ? err.message : err}`);
        const failPath = path.join(outDir, `${slug}-failure.jpg`);
        await page.screenshot({ path: failPath, type: "jpeg", quality: JPEG_QUALITY }).catch(() => {});
        console.error(`[sandbox] State at failure: ${path.relative(REPO_ROOT, failPath)}`);
    }
    finally
    {
        // Leave the room explicitly so the server drops the player now, not at the stale-socket sweep.
        await page.evaluate(() => new Promise((resolve) => {
            const io = window.__socket_io_instance;
            if (!io || io.disconnected) { resolve(); return; }
            io.on("disconnect", () => resolve());
            io.disconnect();
            setTimeout(resolve, 3000);
        })).catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});

        // Removed even on failure, so the next run inherits nothing.
        if (seededRoom != null)
        {
            await removeFreshRoom(seededRoom).then(
                () => console.log(`[sandbox] Removed seeded room ${seededRoom.roomID}.`),
                (err) => console.warn(`[sandbox] Could not remove seeded room ${seededRoom.roomID}: ${err.message}`));
        }
    }

    if (pageErrors.length > 0)
    {
        console.warn(`[sandbox] ${pageErrors.length} console/page error(s) during the run:`);
        for (const err of pageErrors.slice(0, 10))
            console.warn(`  - ${err}`);
    }

    console.log(`[sandbox] ${files.length} screenshot(s) written to ${path.relative(REPO_ROOT, outDir)}/`);
    for (const file of files)
    {
        const size = file.width ? `${file.width}x${file.height}, ` : "";
        console.log(`  - ${file.name} (${size}${Math.round(file.bytes / 1024)} KB)`);
    }

    process.exit(exitCode);
}

/**
 * Holds the browser open and performs one step per request until told to stop. Each response carries
 * the pose, view and selection, so working a sequence out costs a request per guess instead of a run.
 * Ops are the same functions a script calls, under the same names (nothing extra), so findings
 * transcribe directly into `run(ctx)`.
 *
 *   POST /do     {"op": "place", "args": [16.5, 27.2]}
 *   GET  /state  what the game looks like now, without touching it
 *   GET  /ops    every op this session accepts
 *   POST /end    let the browser go and exit
 */
async function serveSession(ctx, port, pageErrors)
{
    const http = require("node:http");
    const ops = buildOps(ctx);

    // Every step returns the same state shape, whether it acts or only looks.
    const state = async () =>
    {
        const [pose, camera, selection, gameMode] = await Promise.all([
            ctx.setup.pose().catch(err => ({error: err.message})),
            ctx.interact.call("camera").catch(err => ({error: err.message})),
            ctx.interact.call("selection").catch(err => ({error: err.message})),
            ctx.interact.gameMode().catch(() => null),
        ]);
        return {pose, camera, selection, gameMode};
    };

    let stopping = null;
    const server = http.createServer((req, res) =>
    {
        const send = (status, body) =>
        {
            res.writeHead(status, {"Content-Type": "application/json"});
            res.end(JSON.stringify(body, null, 2));
        };

        const chunks = [];
        req.on("data", chunk => chunks.push(chunk));
        req.on("end", async () =>
        {
            const url = (req.url || "/").split("?")[0];
            try
            {
                if (url == "/ops")
                    return send(200, {ops: Object.keys(ops).sort()});
                if (url == "/state")
                    return send(200, {ok: true, ...(await state())});
                if (url == "/end")
                {
                    send(200, {ok: true, ending: true});
                    stopping();
                    return;
                }
                if (url != "/do")
                    return send(404, {ok: false, error: `No such endpoint "${url}". Try /do, /state, /ops or /end.`});

                const body = chunks.length == 0 ? {} : JSON.parse(Buffer.concat(chunks).toString());
                const op = ops[body.op];
                if (op == undefined)
                {
                    return send(400, {ok: false,
                        error: `No such op "${body.op}". GET /ops lists them.`});
                }

                const before = pageErrors.length;
                const result = await op(...(body.args || []));
                // Only the errors this step provoked.
                const errors = pageErrors.slice(before);
                send(200, {ok: true, result, ...(await state()),
                    ...(errors.length > 0 ? {errors} : {})});
            }
            catch (err)
            {
                // A failed step still returns the state (the error usually explains why), and the session stays up.
                send(200, {ok: false, error: String(err && err.message ? err.message : err),
                    ...(await state().catch(() => ({})))});
            }
        });
    });

    await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    const address = `http://127.0.0.1:${server.address().port}`;
    console.log(`[sandbox] Session open at ${address} — ${Object.keys(ops).length} ops (GET ${address}/ops).`);
    console.log(`[sandbox]   curl -s ${address}/do -d '{"op":"standingSpots","args":[{}]}'`);
    console.log(`[sandbox]   curl -s ${address}/end     to finish`);

    await new Promise((resolve) => {
        stopping = () => server.close(() => resolve());
        process.once("SIGINT", stopping);
        process.once("SIGTERM", stopping);
    });
    console.log("[sandbox] Session ended.");
}

// Bridge plumbing is excluded (both libraries define these names, including two different `call`s);
// sessions use `bridge` below instead.
const SESSION_PLUMBING = new Set(["BRIDGE", "call", "hasBridge", "waitForBridge", "hasSetup",
    "waitForSetup", "waitForRoom"]);

/** Every op a script can call, flattened to one name each (`place`, `look`, `shot`); nested groups keep their prefix (`ui.click`). */
function buildOps(ctx)
{
    const ops = {};
    const add = (prefix, source) =>
    {
        for (const [name, value] of Object.entries(source))
        {
            if (SESSION_PLUMBING.has(name))
                continue;
            if (typeof value == "function")
                ops[prefix + name] = value;
            else if (value != null && typeof value == "object")
                add(`${prefix}${name}.`, value);
        }
    };

    add("", {
        shot: ctx.shot, sleep: ctx.sleep, drag: ctx.drag, clickAt: ctx.clickAt, clickId: ctx.clickId,
        clickText: ctx.clickText, press: ctx.press, hold: ctx.hold, describeUI: ctx.describeUI,
        hideDebugUI: ctx.hideDebugUI, dismissPopups: ctx.dismissPopups,
        hideHUD: ctx.hideHUD, showHUD: ctx.showHUD,
        // The read-only bridge's own methods (`probeGrid`, `objects`, `context`; see AutomationBridgeUtil).
        bridge: (method, ...args) => ctx.interact.call(method, ...args),
    });
    add("", ctx.setup);
    add("", ctx.interact);
    return ops;
}

/** Fails loudly and early rather than letting every later step time out against nothing. */
async function assertServerIsUp()
{
    try
    {
        const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok)
            throw new Error(`/health answered ${res.status}`);
    }
    catch (err)
    {
        console.error(`[sandbox] No dev server answering at ${BASE_URL} (${err.message}).`);
        console.error("[sandbox] Start one first:  node dev/scripts/e2eDevServer.js devnossg");
        process.exit(1);
    }
}

async function openGame(page, runScript, slug, seededRoom)
{
    // The sandbox is reached via a seat whose single-player mode is the sandbox, so it takes no path or
    // dev user (a dev user's own mode would route elsewhere). The admin seat is a separate account.
    if (runScript.sandbox)
    {
        const url = new URL(BASE_URL + "/");
        url.searchParams.set(runScript.admin ? "sandboxadmin" : "sandboxuser", slug);
        console.log(`[sandbox] Opening the sandbox${runScript.admin ? " as an admin" : ""}: ${url.toString()}`);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
        return;
    }

    // A seeded room outranks the script's path (often a stale id from another database).
    const startPath = seededRoom != null ? `/${seededRoom.roomID}` : (runScript.startPath || "/");
    const url = new URL(BASE_URL + startPath);
    // A seeded dev user (not a fresh guest) owns a room, may edit, and keeps dismissed prompts, so runs match.
    if (runScript.devUser)
        url.searchParams.set("devuser", String(runScript.devUser));

    console.log(`[sandbox] Opening ${url.toString()}`);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
}

/** Waits until the client is connected AND actually standing in a room, not merely booted. */
async function waitForGameReady(page)
{
    await page.waitForSelector("#gameCanvasRoot", { timeout: TIMEOUT_SOCKET_MS });
    await page.waitForFunction(() => window.__socket_io_instance != null, null, { timeout: TIMEOUT_SOCKET_MS });
    await page.locator("#uiRoot").getByText(LOADING_INDICATOR_TEXT, { exact: true })
        .waitFor({ state: "hidden", timeout: TIMEOUT_ROOM_MS });

    // The indicator clearing means the room arrived, not its meshes; wait for a room and player, not a fixed delay.
    await Interact.waitForRoom(page, TIMEOUT_ROOM_MS);
    await Setup.waitForSetup(page, TIMEOUT_SOCKET_MS);

    // Instanced batches report no end; two frames and a short settle, as `shot` waits.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(600);
}

// Where the sandbox parks its player, out of the way of a centered subject.
const SANDBOX_PLAYER_CORNER = { x: 1.5, z: 1.5 };

/** Moves the sandbox player (who spawns at the center, where sets are built) out of the way. */
async function parkPlayer(ctx)
{
    await ctx.setup.place(SANDBOX_PLAYER_CORNER.x, SANDBOX_PLAYER_CORNER.z);
}

/**
 * Walks out of the tutorial if the session starts there, and waits for the hub. The tutorial-finished
 * cookie only affects accounts created after it's set, so seeded dev users still start there.
 */
async function leaveTutorial(page)
{
    const skipButton = page.locator("#uiRoot").getByText("Skip Tutorial", { exact: true }).first();
    if (await skipButton.count() == 0 || !(await skipButton.isVisible().catch(() => false)))
        return;

    console.log("[sandbox] Session started in the tutorial — skipping it.");
    await skipButton.click();
    await page.locator("#uiRoot").getByText("Yes", { exact: true }).first().click();
    await waitForGameReady(page);
}

function makeContext({ page, outDir, slug, files, runScript })
{
    const viewport = runScript.viewport || DEFAULT_VIEWPORT;

    /** Waits out any in-flight animation, then keeps a JPEG named `<slug>-<label>.jpg`. */
    const shot = async (label, opts = {}) =>
    {
        const settleMs = opts.settleMs === undefined ? 400 : opts.settleMs;
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(settleMs);

        const name = `${slug}-${label}.jpg`;
        const filePath = path.join(outDir, name);
        // `clip` is page-screenshot only; Playwright rejects it for element screenshots.
        const screenshotOptions = { path: filePath, type: "jpeg", quality: JPEG_QUALITY };
        if (opts.clip && !opts.selector)
            screenshotOptions.clip = opts.clip;
        const target = opts.selector ? page.locator(opts.selector).first() : page;
        await target.screenshot(screenshotOptions);

        const bytes = fs.statSync(filePath).size;
        const wholeViewport = !opts.selector && !opts.clip;
        files.push({
            name, bytes, path: filePath,
            width: wholeViewport ? viewport.width : undefined,
            height: wholeViewport ? viewport.height : undefined,
        });
        console.log(`[sandbox] shot: ${name}`);
        return filePath;
    };

    const sleep = (ms) => page.waitForTimeout(ms);

    const center = () => ({ x: Math.round(viewport.width / 2), y: Math.round(viewport.height / 2) });

    /** A pointer drag across the canvas, in small steps with brief holds, so the game registers a drag gesture. */
    const drag = async (from, to, opts = {}) =>
    {
        const steps = opts.steps || 24;
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.waitForTimeout(opts.holdMs || 120);
        await page.mouse.move(to.x, to.y, { steps });
        await page.waitForTimeout(opts.holdMs || 120);
        await page.mouse.up();
        await page.waitForTimeout(opts.settleMs === undefined ? 300 : opts.settleMs);
    };

    /** A tap on the world: what selects a block, an object, or a doorway. */
    const clickAt = async (point, opts = {}) =>
    {
        await page.mouse.click(point.x, point.y, opts);
        await page.waitForTimeout(opts.settleMs === undefined ? 500 : opts.settleMs);
    };

    // Game buttons are styled divs, so they're found by id or label, not by role.
    const clickId = async (id, opts = {}) =>
    {
        await page.locator(`#${id}`).first().click(opts);
        await page.waitForTimeout(opts.settleMs === undefined ? 500 : opts.settleMs);
    };
    const clickText = async (text, opts = {}) =>
    {
        await page.locator("#uiRoot").getByText(text, { exact: opts.exact !== false }).first().click(opts);
        await page.waitForTimeout(opts.settleMs === undefined ? 500 : opts.settleMs);
    };

    const press = async (key, opts = {}) =>
    {
        await page.keyboard.press(key);
        await page.waitForTimeout(opts.settleMs === undefined ? 200 : opts.settleMs);
    };

    /** Holds a key down for a while — how the player is walked somewhere. */
    const hold = async (key, ms) =>
    {
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
        await page.waitForTimeout(200);
    };

    /** Everything currently on screen that can be clicked or read, with where it is. */
    const describeUI = () => page.evaluate(() =>
    {
        const root = document.getElementById("uiRoot");
        if (!root)
            return [];
        const visible = (el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1)
                return false;
            const s = getComputedStyle(el);
            return s.visibility != "hidden" && s.display != "none" && Number(s.opacity) > 0.05;
        };
        const out = [];
        for (const el of root.querySelectorAll('[id], [class*="cursor-pointer"], input, textarea'))
        {
            if (!visible(el))
                continue;
            const r = el.getBoundingClientRect();
            out.push({
                id: el.id || undefined,
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 60),
                x: Math.round(r.x + r.width / 2),
                y: Math.round(r.y + r.height / 2),
                w: Math.round(r.width),
                h: Math.round(r.height),
            });
        }
        return out;
    });

    /** Hides the in-game debugger toggle. Matches leaf elements only, since an ancestor's text includes the whole HUD. */
    const hideDebugUI = () => page.evaluate(() =>
    {
        const root = document.getElementById("uiRoot");
        if (!root)
            return;
        for (const el of root.querySelectorAll("div, button"))
        {
            if (el.children.length > 0)
                continue;
            const text = (el.textContent || "").trim();
            if (text == "🔍" || text == "Close Debugger")
                el.style.display = "none";
        }
    });

    /**
     * Hides or restores the whole HUD. Only for looking at an isolated subject; anything about the game's
     * own controls keeps the HUD, since it's part of what is under test.
     */
    const showHUD = (visible = true) => page.evaluate((visible) =>
    {
        const root = document.getElementById("uiRoot");
        if (root)
            root.style.visibility = visible ? "" : "hidden";
    }, visible);

    const hideHUD = () => showHUD(false);

    /** Closes popups (e.g. a first-visit welcome) by pressing Escape until none remain. */
    const dismissPopups = async () =>
    {
        for (let i = 0; i < 4; ++i)
        {
            const open = await page.locator('#uiRoot div[class*="z-40"]').count();
            if (open == 0)
                return i;
            await page.keyboard.press("Escape");
            await page.waitForTimeout(400);
        }
        return 4;
    };

    // `setup` arranges the scene (player pose, camera) and `interact` acts in it, aiming from what the page
    // reports; both are bound to this page.
    const setup = bindPage(Setup, page);
    const interact = bindPage(Interact, page);

    return {
        page, outDir, slug, viewport,
        shot, sleep, center, drag, clickAt, clickId, clickText, press, hold,
        describeUI, hideDebugUI, dismissPopups, hideHUD, showHUD,
        setup, interact,
        waitForGameReady: () => waitForGameReady(page),
        log: (...msg) => console.log("[sandbox]", ...msg),
    };
}

// Not page functions; binding them would pass the wrong first argument.
const NOT_PAGE_BOUND = new Set(["sleep", "diagnose"]);

/** Re-exposes a library whose functions take `page` first with it bound (one level deep, e.g. interact's `ui`). */
function bindPage(library, page)
{
    const bound = {};
    for (const [name, value] of Object.entries(library))
    {
        if (typeof value == "function")
            bound[name] = NOT_PAGE_BOUND.has(name) ? value : (...args) => value(page, ...args);
        else if (value != null && typeof value == "object")
            bound[name] = bindPage(value, page);
        else
            bound[name] = value;
    }
    return bound;
}

main().catch((err) => {
    console.error("[sandbox] Fatal error:", err);
    process.exit(1);
});
