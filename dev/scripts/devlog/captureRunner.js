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
 *   node dev/scripts/devlog/captureRunner.js <script> --out=test-results/devlog-probe
 *   node dev/scripts/devlog/captureRunner.js <script> --headed
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
    const outArg = args.find(a => a.startsWith("--out="));
    const scriptPath = args.find(a => !a.startsWith("--"));

    if (!scriptPath && !probeOnly)
    {
        console.error("Usage: node dev/scripts/devlog/captureRunner.js <shotScript.js> [--out=dir] [--headed]");
        console.error("       node dev/scripts/devlog/captureRunner.js --probe");
        process.exit(1);
    }

    const shotScript = scriptPath ? require(path.resolve(REPO_ROOT, scriptPath)) : {};
    const slug = shotScript.slug || "probe";

    if (scriptPath && !probeOnly && typeof shotScript.run != "function")
    {
        console.error(`[devlog] ${scriptPath} exports no run() function.`);
        process.exit(1);
    }
    if (scriptPath && !probeOnly && !shotScript.slug)
    {
        console.error(`[devlog] ${scriptPath} exports no slug — it names every file the run produces.`);
        process.exit(1);
    }

    const outDir = path.resolve(REPO_ROOT,
        outArg ? outArg.slice("--out=".length) : (probeOnly ? PROBE_OUT_DIR : DEFAULT_OUT_DIR));
    fs.mkdirSync(outDir, { recursive: true });

    await assertServerIsUp();

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
        await openGame(page, shotScript);
        await waitForGameReady(page);

        const ctx = makeContext({ page, outDir, slug, files, shotScript });

        if (shotScript.tutorial !== true)
            await leaveTutorial(page);
        if (shotScript.hideDebugUI !== false)
            await ctx.hideDebugUI();
        if (shotScript.dismissPopups !== false)
            await ctx.dismissPopups();

        if (probeOnly)
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

async function openGame(page, shotScript)
{
    const url = new URL(BASE_URL + (shotScript.startPath || "/"));
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
    // The first frames of a freshly loaded room are its meshes arriving one instanced batch at a
    // time, so a moment is left for the room to finish becoming itself before anything is captured.
    await page.waitForTimeout(1500);
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

    return {
        page, outDir, slug, viewport,
        shot, sleep, center, drag, clickAt, clickId, clickText, press, hold,
        describeUI, hideDebugUI, dismissPopups,
        waitForGameReady: () => waitForGameReady(page),
        log: (...msg) => console.log("[devlog]", ...msg),
    };
}

main().catch((err) => {
    console.error("[devlog] Fatal error:", err);
    process.exit(1);
});
