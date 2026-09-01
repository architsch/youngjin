/**
 * Screenshot runner for dev-log posts (driven by the `devlog-post` Claude skill).
 *
 * Boots a Chromium session against a local dev server, signs in as a seeded dev member,
 * waits until the game is actually in a room, and then hands control to a "shot script" —
 * a small module under ./shots that walks the game through whatever a given feature needs
 * to be seen, calling `shot(label)` at each moment worth keeping.
 *
 * Usage:
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *   node dev/scripts/devlog/captureRunner.js --probe                       (boot + dump the UI)
 *   node dev/scripts/devlog/captureRunner.js --serve                       (hold it open; see below)
 *   node dev/scripts/devlog/captureRunner.js --serve --fresh-room --room-type=hub
 *   node dev/scripts/devlog/captureRunner.js <script> --out=test-results/devlog-probe
 *   node dev/scripts/devlog/captureRunner.js <script> --headed
 *   node dev/scripts/devlog/captureRunner.js <script> --fresh-room         (a generated room instead)
 *
 * A run opens in the SANDBOX unless it asks for something else: an empty room whose camera is off
 * the player entirely and whose walls, floors, pictures and doors are stood up by asking. That is
 * where a post's photographs are made. The alternative is to go and find a subject inside a room the
 * generator built, and then take the picture from wherever the search ended — which is most of a
 * run's wall-clock time, comes out slightly different every time, and leaves the frame composed by
 * the search rather than by the photographer.
 *
 * `--fresh-room` (or `freshRoom: true` on the shot script) seeds a generated room from a fixed seed
 * and opens on that instead. It is for the shot that is genuinely of a generated room — how a hub is
 * laid out, what procedural generation produced — and for driving the game's own flows, which is
 * what a playtest does. Everything else is quicker, steadier and better composed in the sandbox.
 *
 * `--serve` is the one to reach for while a shot is being worked out. Writing a whole script and
 * running it from boot to find out what one click did costs a full run per guess, and most guesses
 * are wrong the first time; this holds one browser open and performs one step per request, handing
 * back the pose, the view and what is selected each time. Every op is the same function the batch
 * scripts call, so a sequence found this way transcribes straight into a shot script rather than
 * having to be translated into one.
 *
 * The dev server is expected to be up already (`npm run devnossg`); this script never starts
 * one, so that a capture run can never take down a server someone else is using.
 *
 * Environment:
 *   DEVLOG_BASE_URL   address of the dev server (default http://127.0.0.1:3000)
 *   DEVLOG_OUT_DIR    where the JPEGs go (default: the current dev-log year's directory —
 *                     see devlogDir.js for which year that is and why it can still be last year's)
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const { resolveDevlogDir } = require("./devlogDir");
const { seedCaptureRoom, removeCaptureRoom } = require("./captureRoom");
const Interact = require("../lib/interact");
const Setup = require("../lib/setup");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const BASE_URL = (process.env.DEVLOG_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const DEFAULT_OUT_DIR = process.env.DEVLOG_OUT_DIR || resolveDevlogDir().dir;
const PROBE_OUT_DIR = "test-results/devlog-probe"; // git-ignored, so probe shots never reach a commit

// Post images are shown at half a column's width on a wide screen, so a viewport-sized JPEG at
// 1x is already more than the page can use — and it doubles as the post's share-preview image.
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const JPEG_QUALITY = 88;

const TIMEOUT_SOCKET_MS = 20_000;
const TIMEOUT_ROOM_MS = 45_000;

// Where a session listens when --serve is given no port of its own.
const DEFAULT_SERVE_PORT = 4321;

// Text of the full-screen indicator held up while a room change is in flight. Matched inside the
// app's UI root alone, so the page's boot-time stand-in for it can never answer a wait meant for
// the app's own (see tests/e2e/helpers/constants.ts, which matches it the same way).
const LOADING_INDICATOR_TEXT = "Loading...";

// Browser-scoped flag that tells the server this browser has already been through the tutorial.
// Local dev suffixes its cookies so they cannot collide with a live session in the same browser.
const TUTORIAL_FINISHED_COOKIE = "thingspool_tutorial_finished"
    + (/\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE_URL) ? "_dev" : "");

async function main()
{
    const args = process.argv.slice(2);
    const probeOnly = args.includes("--probe");
    const headed = args.includes("--headed");
    const freshRoomFlag = args.includes("--fresh-room");
    const sandboxFlag = args.includes("--sandbox");
    const serveArg = args.find(a => a == "--serve" || a.startsWith("--serve="));
    const servePort = serveArg == undefined ? 0
        : (serveArg.includes("=") ? Number(serveArg.split("=")[1]) : DEFAULT_SERVE_PORT);
    const outArg = args.find(a => a.startsWith("--out="));
    const seedArg = args.find(a => a.startsWith("--seed="));
    // A session has no shot script to say which kind of room it wants, so it is said on the command
    // line. It matters: only a hub is raised through two storeys, and only in a hub are doors an
    // admin's to manage.
    const roomTypeArg = args.find(a => a.startsWith("--room-type="));
    // Likewise the seat. Which one matters as much as the room does: doors are an admin's to manage
    // and nobody else's, so a session investigating them from the member seat is looking at a HUD
    // that was never going to carry the controls.
    const devUserArg = args.find(a => a.startsWith("--devuser="));
    const scriptPath = args.find(a => !a.startsWith("--"));

    if (!scriptPath && !probeOnly && !serveArg)
    {
        console.error("Usage: node dev/scripts/devlog/captureRunner.js <shotScript.js> [--out=dir] [--headed] [--fresh-room]");
        console.error("       node dev/scripts/devlog/captureRunner.js --probe");
        console.error("       node dev/scripts/devlog/captureRunner.js --serve[=port]   (the sandbox, unless --fresh-room)");
        console.error("       node dev/scripts/devlog/captureRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]");
        process.exit(1);
    }

    const shotScript = scriptPath ? require(path.resolve(REPO_ROOT, scriptPath)) : {};
    if (devUserArg)
        shotScript.devUser = Number(devUserArg.slice("--devuser=".length));
    if (roomTypeArg)
        shotScript.roomType = roomTypeArg.slice("--room-type=".length);
    if (sandboxFlag)
        shotScript.sandbox = true;
    if (freshRoomFlag)
        shotScript.freshRoom = true;

    // Two ways of getting a room that answer the same question differently, so asking for both says
    // nothing about which one was meant.
    if (shotScript.sandbox && shotScript.freshRoom)
    {
        console.error("[devlog] --sandbox and --fresh-room both decide which room to open, and " +
            "they disagree: the sandbox is an empty room a set is built in, a fresh room is one the " +
            "generator made. Pick one.");
        process.exit(1);
    }

    // The sandbox is where a post's photographs are made, so it is what a run gets when it says
    // nothing. A generated room is the exception and has to be asked for by name — which is also
    // what keeps a script that wants one from silently getting an empty room instead.
    if (shotScript.sandbox == undefined)
        shotScript.sandbox = !shotScript.freshRoom;
    const freshRoom = shotScript.freshRoom === true;
    const slug = shotScript.slug || (serveArg ? "session" : "probe");

    if (scriptPath && !probeOnly && !serveArg && typeof shotScript.run != "function")
    {
        console.error(`[devlog] ${scriptPath} exports no run() function.`);
        process.exit(1);
    }
    if (scriptPath && !probeOnly && !serveArg && !shotScript.slug)
    {
        console.error(`[devlog] ${scriptPath} exports no slug — it names every file the run produces.`);
        process.exit(1);
    }

    // A session's shots are working material, not the post's, so they go where a probe's do unless
    // asked for elsewhere — nothing found by feeling around belongs in public/ by default.
    const outDir = path.resolve(REPO_ROOT,
        outArg ? outArg.slice("--out=".length)
            : ((probeOnly || serveArg) ? PROBE_OUT_DIR : DEFAULT_OUT_DIR));
    fs.mkdirSync(outDir, { recursive: true });

    await assertServerIsUp();

    // A room seeded here rather than whichever one the dev database happens to hold, so that the
    // coordinates a shot script is written against mean the same thing on another machine and on the
    // next run. Removed again at the end, which is also what keeps a run from inheriting what the
    // last one built.
    let seededRoom = null;
    if (freshRoom)
    {
        seededRoom = await seedCaptureRoom({
            seed: seedArg ? Number(seedArg.slice("--seed=".length)) : undefined,
            devUser: shotScript.devUser === undefined ? 1 : shotScript.devUser,
            // A shot of anything upstairs has to be taken in a hub: a Regular room is built one
            // storey tall on purpose. See captureRoom.js.
            roomType: shotScript.roomType,
        });
        console.log(`[devlog] Seeded ${seededRoom.roomType == 0 ? "hub" : "regular"} room ` +
            `${seededRoom.roomID} from seed ${seededRoom.seed} ` +
            `(${seededRoom.voxelCount} voxels, ${seededRoom.objectCount} objects).`);
    }

    const browser = await chromium.launch({
        headless: !headed,
        // SwiftShader renders WebGL identically headless or not, which is what makes a capture run
        // reproducible on a machine whose GPU is busy with something else (mirrors the E2E config).
        args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--hide-scrollbars", "--mute-audio"],
    });
    const context = await browser.newContext({
        viewport: shotScript.viewport || DEFAULT_VIEWPORT,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
    });

    // Skipped by default: the tutorial is a single-player room, and a capture that wanted it would
    // have said so. A shot script covering the tutorial itself sets `tutorial: true`.
    if (shotScript.tutorial !== true)
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
        await openGame(page, shotScript, seededRoom);
        await waitForGameReady(page);

        const ctx = makeContext({ page, outDir, slug, files, shotScript });

        // The sandbox is a single-player room too, so it is exempted here as well: walking out of it
        // would land the run in the hub, which is the one room it did not ask for.
        if (shotScript.tutorial !== true && !shotScript.sandbox)
            await leaveTutorial(page);
        if (shotScript.sandbox)
            await parkPlayer(ctx);
        if (shotScript.hideDebugUI !== false)
            await ctx.hideDebugUI();
        if (shotScript.dismissPopups !== false)
            await ctx.dismissPopups();

        if (serveArg)
        {
            await serveSession(ctx, servePort, pageErrors);
        }
        else if (probeOnly)
        {
            console.log("[devlog] --- visible UI ---");
            console.log(JSON.stringify(await ctx.describeUI(), null, 2));
            await ctx.shot("probe");
        }
        else
        {
            await shotScript.run(ctx);
        }
    }
    catch (err)
    {
        exitCode = 1;
        console.error(`[devlog] Capture failed: ${err && err.message ? err.message : err}`);
        // The state the run died in is usually the whole explanation, so it is kept — outside the
        // post's own directory, where a failed run has no business leaving anything behind.
        const failDir = path.resolve(REPO_ROOT, PROBE_OUT_DIR);
        fs.mkdirSync(failDir, { recursive: true });
        const failPath = path.join(failDir, `${slug}-failure.jpg`);
        await page.screenshot({ path: failPath, type: "jpeg", quality: JPEG_QUALITY }).catch(() => {});
        console.error(`[devlog] State at failure: ${path.relative(REPO_ROOT, failPath)}`);
    }
    finally
    {
        // Leave the room the way a closing tab would not: the server drops the player at once,
        // instead of leaving a ghost standing there until the stale-socket sweep catches it.
        await page.evaluate(() => new Promise((resolve) => {
            const io = window.__socket_io_instance;
            if (!io || io.disconnected) { resolve(); return; }
            io.on("disconnect", () => resolve());
            io.disconnect();
            setTimeout(resolve, 3000);
        })).catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});

        // Removed even when the run failed. A seeded room left behind is exactly the state the next
        // run would inherit, which is the thing seeding one was meant to stop.
        if (seededRoom != null)
        {
            await removeCaptureRoom(seededRoom).then(
                () => console.log(`[devlog] Removed seeded room ${seededRoom.roomID}.`),
                (err) => console.warn(`[devlog] Could not remove seeded room ${seededRoom.roomID}: ${err.message}`));
        }
    }

    if (pageErrors.length > 0)
    {
        console.warn(`[devlog] ${pageErrors.length} console/page error(s) during the run:`);
        for (const err of pageErrors.slice(0, 10))
            console.warn(`  - ${err}`);
    }

    console.log(`[devlog] ${files.length} screenshot(s) written to ${path.relative(REPO_ROOT, outDir)}/`);
    for (const file of files)
    {
        const size = file.width ? `${file.width}x${file.height}, ` : "";
        console.log(`  - ${file.name} (${size}${Math.round(file.bytes / 1024)} KB)`);
    }

    process.exit(exitCode);
}

/**
 * Holds the browser open and performs one step per request, until asked to stop.
 *
 * The point is what it costs to find something out. A shot is a sequence of gestures against a room
 * whose layout nothing wrote down, and most of the sequence is wrong the first time — a click lands
 * on the wall behind the picture, a vantage turns out to be looking at a blank corner. Written as a
 * script, learning any of that costs a run from boot; here it costs a request, and the answer comes
 * back with the pose, the view and what is now selected, so the next step is chosen from what the
 * game actually did rather than from what it was expected to do.
 *
 * The ops are the same functions a shot script calls, under the same names, so what is found here is
 * transcribed into `run(ctx)` rather than translated. Nothing is available through this that is not
 * available there — a session that could do more would be a session whose findings do not keep.
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

    // What every step answers with. A step that acts and a step that only looks return the same
    // shape, so a caller never has to ask a second question to find out what the first one did.
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
                // Only what this step provoked. The whole list would repeat every earlier error at
                // every later step, which buries the one that belongs to what just happened.
                const errors = pageErrors.slice(before);
                send(200, {ok: true, result, ...(await state()),
                    ...(errors.length > 0 ? {errors} : {})});
            }
            catch (err)
            {
                // A failed step is an answer too — usually the interesting one, since the libraries
                // say why an aim could not be made to work. So the state comes back with it, and the
                // session stays up.
                send(200, {ok: false, error: String(err && err.message ? err.message : err),
                    ...(await state().catch(() => ({})))});
            }
        });
    });

    await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    const address = `http://127.0.0.1:${server.address().port}`;
    console.log(`[devlog] Session open at ${address} — ${Object.keys(ops).length} ops (GET ${address}/ops).`);
    console.log(`[devlog]   curl -s ${address}/do -d '{"op":"standingSpots","args":[{}]}'`);
    console.log(`[devlog]   curl -s ${address}/end     to finish`);

    await new Promise((resolve) => {
        stopping = () => server.close(() => resolve());
        process.once("SIGINT", stopping);
        process.once("SIGTERM", stopping);
    });
    console.log("[devlog] Session ended.");
}

// Getting to a bridge is not a step against the game, and both libraries carry the same names for
// doing it — including a `call` each, meaning two different bridges. Left out rather than allowed to
// shadow one another, with `bridge` below offered instead for the one case a session wants: asking
// the read-only bridge something the libraries do not wrap.
const SESSION_PLUMBING = new Set(["BRIDGE", "call", "hasBridge", "waitForBridge", "hasSetup",
    "waitForSetup", "waitForRoom"]);

/**
 * The ops a session accepts: everything a shot script has, flattened to one name each. The names are
 * the ones the calls have in a script — `place`, `look`, `clickObject`, `shot` — so a sequence found
 * here is transcribed rather than translated. Nested groups keep their prefix (`ui.click`).
 */
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
        // The read-only bridge's own methods, for the questions the libraries do not wrap —
        // `probeGrid`, `objects`, `context`. See AutomationBridgeUtil for what it answers.
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
        console.error(`[devlog] No dev server answering at ${BASE_URL} (${err.message}).`);
        console.error("[devlog] Start one first:  node dev/scripts/e2eDevServer.js devnossg");
        process.exit(1);
    }
}

async function openGame(page, shotScript, seededRoom)
{
    // The sandbox is reached by asking for a seat in it rather than by naming a room: the server
    // routes a user to the single-player room its mode names, and this seat's mode is the sandbox's.
    // So it takes neither a path nor a dev member — a dev member has a mode of their own and would
    // be sent somewhere else entirely.
    if (shotScript.sandbox)
    {
        const url = new URL(BASE_URL + "/");
        url.searchParams.set("sandboxuser", shotScript.slug || "session");
        console.log(`[devlog] Opening the sandbox: ${url.toString()}`);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
        return;
    }

    // A seeded room is the one the run was started for, so it outranks whatever path the script
    // names — which is usually a room id from a previous run against a different database.
    const startPath = seededRoom != null ? `/${seededRoom.roomID}` : (shotScript.startPath || "/");
    const url = new URL(BASE_URL + startPath);
    // A seeded dev member, rather than a fresh guest: it owns a room, may edit, and keeps whatever
    // first-time prompts it has already dismissed — so consecutive runs capture the same game.
    const devUser = shotScript.devUser === undefined ? 1 : shotScript.devUser;
    if (devUser)
        url.searchParams.set("devuser", String(devUser));

    console.log(`[devlog] Opening ${url.toString()}`);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
}

/** Waits until the client is connected AND actually standing in a room, not merely booted. */
async function waitForGameReady(page)
{
    await page.waitForSelector("#gameCanvasRoot", { timeout: TIMEOUT_SOCKET_MS });
    await page.waitForFunction(() => window.__socket_io_instance != null, null, { timeout: TIMEOUT_SOCKET_MS });
    await page.locator("#uiRoot").getByText(LOADING_INDICATOR_TEXT, { exact: true })
        .waitFor({ state: "hidden", timeout: TIMEOUT_ROOM_MS });

    // The indicator coming down says the room arrived, not that there is yet anything standing in
    // it: its meshes arrive one instanced batch at a time over the frames that follow. So the page
    // is asked when it has a room and a player rather than being given a fixed moment to get one —
    // how long that takes depends on the room, and a room that takes longer than the guess is
    // photographed half-built.
    await Interact.waitForRoom(page, TIMEOUT_ROOM_MS);
    await Setup.waitForSetup(page, TIMEOUT_SOCKET_MS);

    // What is left is the batches themselves, which nothing reports the end of. Two frames and a
    // short settle is the same wait `shot` makes before every capture.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(600);
}

// Where the sandbox stands its player while a set is built in the middle of the room. Far enough
// into a corner to be outside any frame a subject at the centre is shot from.
const SANDBOX_PLAYER_CORNER = { x: 1.5, z: 1.5 };

/**
 * Stands the sandbox's player out of the way.
 *
 * The camera in there is free of him, but he is not free of the room: he spawns at its centre, which
 * is exactly where a set gets built, so he ends up inside the subject with his name over it. Nothing
 * in a sandbox shot is ever of him — a shot that wanted a character in it would be taken in a room
 * with characters — so he is moved once here rather than left for each script to remember, which is
 * the kind of thing that is only remembered after seeing him in the picture.
 */
async function parkPlayer(ctx)
{
    await ctx.setup.place(SANDBOX_PLAYER_CORNER.x, SANDBOX_PLAYER_CORNER.z);
}

/**
 * Walks out of the single-player tutorial if the session started inside it, and waits for the hub
 * to load in its place. The browser's tutorial-finished cookie only governs accounts created after
 * it was set, so a seeded dev member — created by the server at boot, before any browser said
 * anything — still starts in the tutorial and has to be walked out of it.
 */
async function leaveTutorial(page)
{
    const skipButton = page.locator("#uiRoot").getByText("Skip Tutorial", { exact: true }).first();
    if (await skipButton.count() == 0 || !(await skipButton.isVisible().catch(() => false)))
        return;

    console.log("[devlog] Session started in the tutorial — skipping it.");
    await skipButton.click();
    await page.locator("#uiRoot").getByText("Yes", { exact: true }).first().click();
    await waitForGameReady(page);
}

function makeContext({ page, outDir, slug, files, shotScript })
{
    const viewport = shotScript.viewport || DEFAULT_VIEWPORT;

    /** Waits out any in-flight animation, then keeps a JPEG named `<slug>-<label>.jpg`. */
    const shot = async (label, opts = {}) =>
    {
        const settleMs = opts.settleMs === undefined ? 400 : opts.settleMs;
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(settleMs);

        const name = `${slug}-${label}.jpg`;
        const filePath = path.join(outDir, name);
        // `clip` belongs to a page screenshot alone — an element screenshot is already its own clip,
        // and Playwright rejects the option there.
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
        console.log(`[devlog] shot: ${name}`);
        return filePath;
    };

    const sleep = (ms) => page.waitForTimeout(ms);

    const center = () => ({ x: Math.round(viewport.width / 2), y: Math.round(viewport.height / 2) });

    /**
     * A pointer drag across the game canvas. Moved in many small steps, and held briefly at each
     * end, because the game reads a drag as a gesture in its own right (it only becomes one past a
     * few pixels of travel) rather than as a jump from one point to another.
     */
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

    // The game's buttons are styled divs, not <button> elements, so role-based locators find
    // nothing — they are reached by their id where they have one, and by their label otherwise.
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

    /**
     * Takes the in-game debugger's toggle out of shot; it is a development tool, not part of the
     * feature. Only leaf elements are considered: an ancestor's text includes everything beneath
     * it, so matching on text alone would hide whole branches of the HUD along with the button.
     */
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
     * Takes the whole HUD out of shot, and gives it back — the chat bar along the bottom, the seat's
     * name in the corner, the mode controls.
     *
     * For a shot of the game this is the wrong thing to do: the HUD is part of what the game looks
     * like, and a picture of the world with the interface cut away is a picture of something nobody
     * sees. It is for the other kind of shot — one thing on its own, against nothing, usually built
     * in the sandbox — where the interface is not in the picture so much as in the way.
     *
     * Visibility rather than removal, so it can be given back within the same run: a session
     * arranging several shots may want it for one of them.
     */
    const showHUD = (visible = true) => page.evaluate((visible) =>
    {
        const root = document.getElementById("uiRoot");
        if (root)
            root.style.visibility = visible ? "" : "hidden";
    }, visible);

    const hideHUD = () => showHUD(false);

    /**
     * Clears whatever popup is standing (a first-visit welcome, say). Escape closes the topmost
     * one, so it is offered repeatedly until nothing is left to close.
     */
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

    // The two halves of driving the game, bound to this page so a shot script calls them without
    // passing it in. `setup` arranges the scene — where the player stands, where the camera looks
    // from — and `interact` acts in it, aiming from what the page reports rather than from
    // coordinates written down on a previous run. Between them they replace what shot scripts used
    // to do by holding a walk key and sweeping candidate pixels.
    const setup = bindPage(Setup, page);
    const interact = bindPage(Interact, page);

    return {
        page, outDir, slug, viewport,
        shot, sleep, center, drag, clickAt, clickId, clickText, press, hold,
        describeUI, hideDebugUI, dismissPopups, hideHUD, showHUD,
        setup, interact,
        waitForGameReady: () => waitForGameReady(page),
        log: (...msg) => console.log("[devlog]", ...msg),
    };
}

// The two functions in those libraries that are not about a page: one waits, the other reads a
// report the caller already has. Binding them to a page would quietly give them the wrong first
// argument, which is the kind of mistake that shows up as a nonsense failure much later.
const NOT_PAGE_BOUND = new Set(["sleep", "diagnose"]);

/**
 * Re-exposes a library whose functions take `page` first as one that already has it. Nested objects
 * (interact's `ui`) are bound the same way one level down, which is as deep as either library goes.
 */
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
    console.error("[devlog] Fatal error:", err);
    process.exit(1);
});
