// Runs one playtest agent's plan (JSON in, JSON result out) against a deployed server in a real browser;
// agents iterate plan by plan, a middle ground between per-click driving and a fixed script.
//   - A real browser and Socket.IO connection, so the server sees a genuine concurrent player.
//   - Data assertions (room lists, search, ownership) use the page's authenticated request context.
//   - HUD controls with stable ids are clicked for real.
//   - The 3D scene is driven via ../lib/interact.js with real pointer input, so a failing world action
//     would fail for a player too.
//   - Scene arrangement ("place", "vantage", "look") uses ../lib/setup.js directly: arranging is set,
//     acting is performed.
//
// Usage:
//   node dev/scripts/playtest/runPlan.js <plan.json> [--out <result.json>]

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const Interact = require("../lib/interact");
const Setup = require("../lib/setup");

const DEFAULT_BASE_URL = "https://staging.thingspool.net";
const ARTIFACT_DIR = path.join(__dirname, "../../../temp/playtest/artifacts");

// Staging allows 20 requests/min per IP, shared by every agent on this machine, so requests are spaced
// and 429s are reported as their own outcome.
const MIN_REQUEST_SPACING_MS = 1200;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runPlan(plan)
{
    const baseURL = (plan.baseURL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const agentName = plan.agent || "agent";
    const results = [];
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    let rateLimitHits = 0;
    let lastRequestAt = 0;

    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    const browser = await chromium.launch({
        headless: plan.headless !== false,
        args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
    });

    // Optional cookie file persisting the session across plans, for scenarios that change an account
    // between plans (e.g. promoting a user); otherwise each plan starts as a fresh visitor.
    const sessionFile = plan.sessionFile
        ? path.resolve(process.cwd(), plan.sessionFile)
        : null;
    const resumedSession = sessionFile != null && fs.existsSync(sessionFile);

    // Distinct User-Agents per agent: guest creation is capped per IP + User-Agent.
    const context = await browser.newContext({
        userAgent: plan.userAgent || `ThingspoolPlaytest-${agentName}/1.0`,
        ignoreHTTPSErrors: true,
        ...(resumedSession ? { storageState: sessionFile } : {}),
        // Software WebGL: frame rate scales with pixel count, so a narrow viewport doubles as a phone and a
        // speed-up.
        viewport: plan.viewport || { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 500)); });
    page.on("pageerror", err => pageErrors.push(String(err).substring(0, 500)));

    // Collects failed requests and same-origin error responses, catching assets a deploy forgot (the page
    // otherwise loads fine without them).
    page.on("requestfailed", req => {
        if (!req.url().startsWith(baseURL)) return;
        failedRequests.push({ url: req.url().substring(0, 200), reason: req.failure()?.errorText || "" });
    });
    page.on("response", res => {
        const status = res.status();
        if (status < 400 || !res.url().startsWith(baseURL)) return;
        // 429 is the rate limiter, which is counted on its own and is usually self-inflicted.
        if (status === 429) return;
        failedRequests.push({ url: res.url().substring(0, 200), reason: `HTTP ${status}` });
    });

    async function apiPost(route, body)
    {
        // Space requests so a burst does not trip the per-IP limiter.
        const since = Date.now() - lastRequestAt;
        if (since < MIN_REQUEST_SPACING_MS) await sleep(MIN_REQUEST_SPACING_MS - since);
        lastRequestAt = Date.now();

        const response = await page.request.post(`${baseURL}/${route}`, { data: body, failOnStatusCode: false });
        const status = response.status();
        if (status === 429) rateLimitHits++;

        let payload = null;
        try { payload = await response.json(); }
        catch { payload = (await response.text()).substring(0, 200); }
        return { status, payload };
    }

    for (const [index, action] of (plan.actions || []).entries())
    {
        const startedAt = Date.now();
        const record = { index, type: action.type, ok: true };

        try
        {
            switch (action.type)
            {
                case "start":
                {
                    // Visiting the root creates a guest. An optional `ref` becomes the traffic-source tag
                    // (read only on the account-minting visit), isolating the run's guests in their own cohort.
                    // `devUser` picks a seeded dev account (dev mode only); on deployments, promote an
                    // account instead (see stagingAdmin.js set-user-type).
                    const params = new URLSearchParams();
                    if (action.ref) params.set("ref", action.ref);
                    if (action.devUser != null) params.set("devuser", String(action.devUser));
                    const query = params.toString() ? `?${params}` : "";

                    const response = await page.goto(`${baseURL}/${query}`,
                        { waitUntil: "networkidle", timeout: 60_000 });
                    record.status = response?.status() ?? 0;
                    if (record.status === 429) rateLimitHits++;
                    if (action.ref) record.ref = action.ref;
                    if (action.devUser != null) record.devUser = action.devUser;

                    // Guest creation is capped per IP and User-Agent, so a 401 here means the machine hit
                    // that cap (not a broken deploy).
                    if (record.status === 401)
                    {
                        throw new Error(
                            `The server would not start a session (HTTP 401 on the landing page). ` +
                            `Guest creation is capped per IP and per User-Agent, and this machine ` +
                            `has spent that budget — give the agent a User-Agent of its own, resume ` +
                            `a session file, or wait for the cap to lapse.`);
                    }
                    record.resumedSession = resumedSession;
                    record.env = await page.evaluate(() => window.thingspool_env ?? null).catch(() => null);
                    break;
                }

                case "waitForRoom":
                {
                    // The loading indicator clearing proves the server placed this user in a room.
                    await page.locator("#uiRoot").getByText("Loading...", { exact: true })
                        .waitFor({ state: "hidden", timeout: action.timeout || 45_000 });
                    record.socketConnected = await page.evaluate(() => {
                        const io = (window).__socket_io_instance;
                        return io ? io.connected === true : false;
                    });

                    // The room arrived, but its contents (and character) spawn afterwards, so wait for the
                    // bridge's room report too.
                    if (await Interact.hasBridge(page))
                        record.roomReady = await Interact.waitForRoom(page, action.timeout || 45_000);
                    break;
                }

                case "skipTutorial":
                {
                    // New guests start in the tutorial, where navigating to a room ID appears to succeed but
                    // doesn't; multiplayer checks before this test nothing.
                    const skip = page.locator("#uiRoot").getByText("Skip Tutorial", { exact: true });
                    const appeared = await skip.waitFor({ state: "visible", timeout: action.timeout || 20_000 })
                        .then(() => true).catch(() => false);

                    if (!appeared)
                    {
                        // A reused session may have already left the tutorial.
                        record.skipped = "no tutorial active";
                        break;
                    }

                    await skip.click();
                    await page.locator("#uiRoot").getByText("Yes", { exact: true })
                        .click({ timeout: 10_000 });
                    // Leaving the tutorial hands the player to a hub, which is a room change.
                    await page.locator("#uiRoot").getByText("Loading...", { exact: true })
                        .waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
                    record.leftTutorial = true;
                    break;
                }

                case "dismissPopups":
                {
                    // First-arrival welcome popups cover the screen and intercept clicks, so each is
                    // recorded and dismissed.
                    const backdrop = page.locator("#uiRoot div.z-40");
                    const dismissed = [];

                    for (let attempt = 0; attempt < (action.max || 4); attempt++)
                    {
                        if (await backdrop.count() === 0) break;
                        dismissed.push((await backdrop.first().innerText().catch(() => ""))
                            .replace(/\s+/g, " ").trim().substring(0, 120));
                        await page.keyboard.press("Escape");
                        await sleep(400);
                    }

                    record.dismissed = dismissed;
                    record.remaining = await backdrop.count();
                    break;
                }

                case "enterEditMode":
                {
                    await page.locator("#gameModeToggleSwitch").click({ timeout: action.timeout || 15_000 });
                    await Interact.waitForGameMode(page, "edit", 15_000);
                    // Read separately: the page being in the mode doesn't prove the switch shows it.
                    record.switchShowsEdit =
                        await page.locator("#gameModeToggleSwitch").getAttribute("aria-checked") === "true";
                    break;
                }

                case "exitEditMode":
                {
                    await page.locator("#gameModeToggleSwitch").click({ timeout: action.timeout || 15_000 });
                    await Interact.waitForGameMode(page, "play", 15_000);
                    record.switchShowsEdit =
                        await page.locator("#gameModeToggleSwitch").getAttribute("aria-checked") === "true";
                    break;
                }

                case "click":
                {
                    // Escape hatch for unnamed UI: selectors belong in plans, not hard-coded here.
                    const target = page.locator(action.selector).nth(action.nth || 0);
                    await target.click({ timeout: action.timeout || 10_000 });
                    if (action.settleMs) await sleep(action.settleMs);
                    break;
                }

                case "fill":
                {
                    // Popup fields are plain inputs, addressed by selector (the form carries the id; see Form's `id`).
                    await Interact.ui.fill(page, action.selector, String(action.text ?? ""));
                    record.selector = action.selector;
                    if (action.settleMs) await sleep(action.settleMs);
                    break;
                }

                case "uiClick":
                {
                    // Clicked only if enabled: these are divs, so a DOM-only click on a disabled one
                    // "succeeds" and does nothing (see Interact.ui.isEnabled).
                    await Interact.ui.click(page, action.elementId, {
                        timeout: action.timeout,
                        settleMs: action.settleMs,
                    });
                    record.elementId = action.elementId;
                    break;
                }

                case "expectDisabled":
                {
                    // The refusal itself is often what's under test.
                    await Interact.ui.waitFor(page, action.elementId, {timeout: action.timeout});
                    record.elementId = action.elementId;
                    record.enabled = await Interact.ui.isEnabled(page, action.elementId);
                    if (record.enabled)
                        throw new Error(`#${action.elementId} is enabled, but was expected to be refused.`);
                    break;
                }

                case "say":
                {
                    // Chat needs no aiming, so it's driven for real end to end (messages travel as player
                    // object changes). Empty messages are ignored in multiplayer rooms, so text is required.
                    const message = String(action.message || "");
                    if (message.length === 0)
                        throw new Error("'say' needs a non-empty message");

                    // Addressed by id, since visible text is localized.
                    await page.locator("#chatTextInput").fill(message, { timeout: action.timeout || 10_000 });
                    await page.locator("#chatSendButton").click({ timeout: action.timeout || 10_000 });
                    record.message = message;
                    if (action.settleMs) await sleep(action.settleMs);
                    break;
                }

                case "expect":
                {
                    const target = page.locator(action.selector);
                    const state = action.state || "visible";
                    await target.first().waitFor({ state, timeout: action.timeout || 10_000 });
                    record.selector = action.selector;
                    record.state = state;
                    record.count = await target.count();
                    break;
                }

                case "gotoRoom":
                {
                    const response = await page.goto(`${baseURL}/${action.roomID}`,
                        { waitUntil: "networkidle", timeout: 60_000 });
                    record.status = response?.status() ?? 0;
                    if (record.status === 429) rateLimitHits++;
                    break;
                }

                case "listRooms":
                {
                    const { status, payload } = await apiPost("api/room/list_rooms", { page: action.page || 0 });
                    record.status = status;
                    record.hasMore = payload?.hasMore;
                    record.count = Array.isArray(payload?.rooms) ? payload.rooms.length : 0;
                    record.rooms = (payload?.rooms || []).map(r => ({
                        id: r.id, owner: r.ownerUserName, roomType: r.roomType,
                    }));
                    break;
                }

                case "searchRooms":
                {
                    const { status, payload } = await apiPost("api/room/search_rooms",
                        { query: action.query, page: action.page || 0 });
                    record.status = status;
                    record.query = action.query;
                    record.hasMore = payload?.hasMore;
                    record.count = Array.isArray(payload?.rooms) ? payload.rooms.length : 0;
                    record.rooms = (payload?.rooms || []).map(r => ({ id: r.id, owner: r.ownerUserName }));
                    break;
                }

                case "hubEntries":
                {
                    const { status, payload } = await apiPost("api/room/get_hub_room_list_entries", {});
                    record.status = status;
                    record.count = Array.isArray(payload?.rooms) ? payload.rooms.length : 0;
                    break;
                }

                case "myRoomEntry":
                {
                    const { status, payload } = await apiPost("api/room/get_my_room_list_entry", {});
                    record.status = status;
                    record.room = payload?.room ?? null;
                    break;
                }

                // ── The world ───────────────────────────────────────────
                // Aims through the page and acts through the browser (see lib/interact.js); each records its
                // aim, so a failure names its silent cause (out of reach, hidden, wrong target).

                case "whoami":
                {
                    // Who the server thinks this session is and what it may do; admin promotion targets the user id.
                    await Interact.waitForBridge(page, action.timeout || 30_000);
                    record.context = await Interact.call(page, "context");
                    break;
                }

                case "reload":
                {
                    // User type is read on every identified request and socket handshake, so a DB promotion
                    // applies on reload.
                    const response = await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
                    record.status = response?.status() ?? 0;
                    if (record.status === 429) rateLimitHits++;
                    break;
                }

                case "objects":
                {
                    await Interact.waitForRoom(page, action.timeout || 45_000);
                    const reports = await Interact.call(page, "objects", action.objectType);
                    record.count = reports.length;
                    // Trimmed to identity, metadata, and clickability from the current position.
                    record.objects = reports.map(o => ({
                        objectId: o.objectId, objectType: o.objectType, metadata: o.metadata,
                        distance: Number(o.distance.toFixed(2)),
                        reachable: o.withinSelectRange && o.inLineOfSight && o.screen != null,
                    }));
                    break;
                }

                case "clickObject":
                {
                    const target = action.target || {};
                    record.target = action.target || {};
                    try
                    {
                        const report = await Interact.clickObject(page, target, {
                            approach: action.approach !== false,
                        });
                        record.objectId = report.objectId;
                        record.objectType = report.objectType;
                        record.distance = Number(report.distance.toFixed(2));
                    }
                    catch (err)
                    {
                        // The walk's steps, so a failed approach shows why.
                        if (err.steps) record.steps = err.steps;
                        throw err;
                    }
                    break;
                }

                case "clickSurface":
                {
                    // A room surface (wall, floor, block face) to hang things on.
                    const hit = await Interact.clickSurface(page, {
                        objectType: action.objectType,
                        grid: action.grid,
                    });
                    record.objectType = hit.objectType;
                    record.world = hit.world;
                    record.distance = Number(hit.distance.toFixed(2));
                    break;
                }

                case "clickSurfaceUntilEnabled":
                {
                    // The plan names the control, and the search finds a surface where the app enables it.
                    try
                    {
                        const found = await Interact.clickSurfaceUntilEnabled(page, action.elementId, {
                            objectType: action.objectType,
                            grid: action.grid,
                            maxAttempts: action.maxAttempts,
                            views: action.views,
                        });
                        record.elementId = action.elementId;
                        record.attempts = found.attempts;
                        record.quad = found.quad;
                        record.world = found.world;
                    }
                    catch (err)
                    {
                        // How each candidate was refused is the finding, so it goes into the record.
                        if (err.tried) record.tried = err.tried.map(t => ({
                            quad: t.quad, outcome: t.outcome,
                        }));
                        throw err;
                    }
                    break;
                }

                case "ensureEditMode":
                    // Deselecting ends edit mode; this re-enters it and reports whether that was needed.
                    record.reentered = await Interact.ensureEditMode(page);
                    record.gameMode = await Interact.gameMode(page);
                    break;

                case "orbit":
                    await Interact.orbit(page, action.dx || 0, action.dy || 0);
                    break;

                case "zoom":
                    await Interact.zoom(page, action.deltaY || 0);
                    break;

                case "walk":
                    await Interact.walk(page, action.keys || "KeyW", action.ms || 500);
                    break;

                // Priming, not playing: start positions are set directly (see dev/scripts/lib/setup.js);
                // tested actions still use real gestures.
                case "place":
                    record.pose = await Setup.place(page, action.x, action.z, {
                        collisionLayer: action.collisionLayer,
                        faceX: action.faceX, faceZ: action.faceZ,
                    });
                    break;

                case "vantage":
                    record.pose = await Setup.vantage(page, {x: action.x, z: action.z},
                        { distance: action.distance, collisionLayer: action.collisionLayer });
                    break;

                case "look":
                    record.view = await Setup.look(page, {
                        azimuthDeg: action.azimuthDeg, polarDeg: action.polarDeg, zoom: action.zoom,
                    });
                    break;

                case "pose":
                    record.pose = await Setup.pose(page);
                    break;

                case "standingSpots":
                    record.spots = await Setup.standingSpots(page, {
                        near: action.near, collisionLayer: action.collisionLayer, limit: action.limit,
                    });
                    break;

                case "expectSelection":
                {
                    // The selection is the only proof a world click landed, and it drives the next action's HUD.
                    const want = action.selection || {};
                    const selection = await Interact.waitForSelection(page, (current) => {
                        if (want.voxelQuad) return current.voxelQuad != null;
                        if (want.none) return current.object == null && current.voxelQuad == null;
                        if (current.object == null) return false;
                        if (want.objectId && current.object.objectId !== want.objectId) return false;
                        if (want.objectType && current.object.objectType !== want.objectType) return false;
                        for (const [key, value] of Object.entries(want.metadata || {}))
                        {
                            if ((current.object.metadata || {})[key] !== String(value)) return false;
                        }
                        return true;
                    }, { timeout: action.timeout || 8000 });
                    record.selection = selection;
                    break;
                }

                case "screenshot":
                {
                    const file = path.join(ARTIFACT_DIR, `${agentName}-${action.name || index}.png`);
                    const buffer = await page.screenshot({ path: file, fullPage: false });
                    record.file = file;
                    // Byte size is a first check: a blank render compresses to almost nothing.
                    record.bytes = buffer.length;
                    break;
                }

                case "wait":
                    await sleep(action.ms || 1000);
                    break;

                case "end":
                {
                    // Leave explicitly, or the player lingers until the stale-socket sweep (ghosts on staging).
                    await page.evaluate(() => new Promise((resolve) => {
                        const io = (window).__socket_io_instance;
                        if (!io || io.disconnected) { resolve(); return; }
                        io.on("disconnect", () => resolve());
                        io.disconnect();
                        setTimeout(resolve, 3000);
                    })).catch(() => {});
                    break;
                }

                default:
                    record.ok = false;
                    record.error = `Unknown action type "${action.type}"`;
            }
        }
        catch (err)
        {
            record.ok = false;
            record.error = String(err.message || err).substring(0, 400);
            try {
                const file = path.join(ARTIFACT_DIR, `${agentName}-fail-${index}.png`);
                await page.screenshot({ path: file });
                record.failureScreenshot = file;
            } catch {}
        }

        record.ms = Date.now() - startedAt;
        results.push(record);
    }

    // Saved even when actions failed, since the minted account is what the next plan resumes.
    if (sessionFile != null)
    {
        fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
        await context.storageState({ path: sessionFile });
    }

    await context.close();
    await browser.close();

    return {
        agent: agentName,
        baseURL,
        finishedAt: new Date().toISOString(),
        sessionFile,
        resumedSession,
        actions: results,
        failedActions: results.filter(r => !r.ok).length,
        rateLimitHits,
        consoleErrors,
        pageErrors,
        failedRequests,
    };
}

async function main()
{
    const planPath = process.argv[2];
    if (!planPath)
    {
        console.error("Usage: node dev/scripts/playtest/runPlan.js <plan.json> [--out <result.json>]");
        process.exit(2);
    }

    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const result = await runPlan(plan);

    const outIndex = process.argv.indexOf("--out");
    if (outIndex >= 0 && process.argv[outIndex + 1])
    {
        fs.mkdirSync(path.dirname(process.argv[outIndex + 1]), { recursive: true });
        fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify(result, null, 2));
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.failedActions > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(JSON.stringify({ error: String(err.message || err) }, null, 2));
    process.exit(1);
});
