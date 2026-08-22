// Runs one playtest agent's plan against a deployed server in a real browser.
//
// An agent writes a plan (JSON), runs it through here, reads the result (JSON), and writes the
// next plan informed by what happened. That round-trip is deliberate: driving a browser one
// click at a time from a model is slow and expensive, and a fixed script cannot react to what
// it finds. A round of a dozen actions is the middle ground.
//
// What this drives, and what it does not:
//   - It runs a real browser with a real Socket.IO connection, so the server sees a genuine
//     concurrent player: room load, presence, physics, the socket lifecycle.
//   - Assertions about *data* (room lists, search, pagination, ownership) go through the
//     page's own authenticated request context. That is the same session and the same cookies
//     as the UI, but it does not depend on clicking anything.
//   - HUD controls that carry a stable element id are driven for real (edit mode, the mode's
//     way out). Anything reached by aiming at the 3D scene — placing a voxel, dragging an
//     object, the door that opens the room list — is not, because where it sits on screen
//     depends on the room that was generated. Screenshots cover whether the client rendered;
//     the request-context checks cover whether the data behind it is right.
//
// Usage:
//   node dev/scripts/playtest/runPlan.js <plan.json> [--out <result.json>]

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const DEFAULT_BASE_URL = "https://staging.thingspool.net";
const ARTIFACT_DIR = path.join(__dirname, "../../../temp/playtest/artifacts");

// The staging server allows 20 requests per minute per IP, and every agent on this machine
// shares one IP. Without pacing, a couple of agents spend their run discovering the rate
// limiter rather than testing anything — so requests are spaced, and any 429 is reported as a
// distinct outcome rather than being mistaken for a server fault.
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

    // A distinct User-Agent per agent matters beyond realism: guest creation is capped per
    // IP *and* User-Agent together, so agents sharing one string would share one small quota.
    const context = await browser.newContext({
        userAgent: plan.userAgent || `ThingspoolPlaytest-${agentName}/1.0`,
        ignoreHTTPSErrors: true,
        // There is no GPU here, so WebGL runs on a software rasterizer and the frame rate is
        // decided almost entirely by how many pixels there are to fill. That makes the viewport
        // a lever rather than a detail: a narrow one both stands in for a phone and buys back
        // enough frames per second for anything that moves to move at a believable speed.
        viewport: plan.viewport || { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 500)); });
    page.on("pageerror", err => pageErrors.push(String(err).substring(0, 500)));

    // A deployment can leave the server serving a bundle that asks for an asset the deployment
    // did not carry — a renamed texture atlas, a new icon — and nothing else in this run would
    // notice: the page still loads, the room still enters, and the missing thing is simply not
    // drawn. So every request that failed outright, and every same-origin response that came
    // back an error, is collected. Requests to other hosts are not this deployment's business.
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
                    // Visiting the root creates a guest and serves the game page in one step.
                    //
                    // An optional `ref` arrives as the query tag the server reads to decide which
                    // traffic source this visitor came from, which is what puts the run's own
                    // guests in a cohort of their own instead of among staging's ordinary
                    // visitors. Attribution is first-touch, so it is only read here, on the visit
                    // that mints the account — a `ref` on any later navigation is ignored.
                    const query = action.ref ? `?ref=${encodeURIComponent(action.ref)}` : "";
                    const response = await page.goto(`${baseURL}/${query}`,
                        { waitUntil: "networkidle", timeout: 60_000 });
                    record.status = response?.status() ?? 0;
                    if (record.status === 429) rateLimitHits++;
                    if (action.ref) record.ref = action.ref;
                    record.env = await page.evaluate(() => window.thingspool_env ?? null).catch(() => null);
                    break;
                }

                case "waitForRoom":
                {
                    // The app's own loading indicator coming down is the client-visible proof
                    // that the server actually placed this user in a room.
                    await page.locator("#uiRoot").getByText("Loading...", { exact: true })
                        .waitFor({ state: "hidden", timeout: action.timeout || 45_000 });
                    record.socketConnected = await page.evaluate(() => {
                        const io = (window).__socket_io_instance;
                        return io ? io.connected === true : false;
                    });
                    break;
                }

                case "skipTutorial":
                {
                    // A newly created guest starts in the single-player tutorial, not in a
                    // multiplayer room. Until it leaves, navigating to a room ID appears to
                    // succeed while the client stays in the tutorial — so any multiplayer or
                    // room-list check run before this is testing nothing.
                    const skip = page.locator("#uiRoot").getByText("Skip Tutorial", { exact: true });
                    const appeared = await skip.waitFor({ state: "visible", timeout: action.timeout || 20_000 })
                        .then(() => true).catch(() => false);

                    if (!appeared)
                    {
                        // Not an error: an agent reusing a session that already left the
                        // tutorial has nothing to skip.
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
                    // Arriving somewhere now opens a popup of its own the first time: a welcome
                    // for the hub, another for the user's own room. They are correct behaviour,
                    // but they sit over the whole screen, so a screenshot taken behind one shows
                    // the popup rather than the room, and every later click lands on its backdrop.
                    // What was on screen is recorded before it goes, so the report can say which
                    // popup appeared rather than merely how many did.
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
                    // Edit mode opens on the user's own character, so the character's own controls
                    // coming up is the client-visible proof that the mode arrived with a selection
                    // under it — a mode standing over nothing would still show its own way out.
                    await page.locator("#editModeButton").click({ timeout: action.timeout || 15_000 });
                    await page.locator("#customizePlayerOptions")
                        .waitFor({ state: "visible", timeout: 15_000 });
                    record.exitButtonShown = await page.locator("#modeExitButton").isVisible();
                    break;
                }

                case "exitEditMode":
                {
                    await page.locator("#modeExitButton").click({ timeout: action.timeout || 15_000 });
                    await page.locator("#customizePlayerOptions")
                        .waitFor({ state: "hidden", timeout: 15_000 });
                    // The mode gives the top bar back to the identity controls on its way out, so
                    // the way back in returning is what says the mode really ended.
                    record.editModeButtonShown = await page.locator("#editModeButton").isVisible();
                    break;
                }

                case "click":
                {
                    // The escape hatch for UI this harness does not name. A plan is written after
                    // reading the run before it, so a selector belongs in the plan rather than
                    // baked in here, where it would go stale on the next markup change and take a
                    // whole run down with it.
                    const target = page.locator(action.selector).nth(action.nth || 0);
                    await target.click({ timeout: action.timeout || 10_000 });
                    if (action.settleMs) await sleep(action.settleMs);
                    break;
                }

                case "say":
                {
                    // Chat is the one player-to-player action that is reachable without aiming at
                    // the 3D scene, so unlike building it can be driven for real. It is also the
                    // only way to exercise the chat path end to end — a message travels as a
                    // change to the speaker's own player object, so nothing offline proves that a
                    // real one leaves the browser.
                    //
                    // An empty message is ignored by the client in a multiplayer room, so the text
                    // is required rather than defaulted.
                    const message = String(action.message || "");
                    if (message.length === 0)
                        throw new Error("'say' needs a non-empty message");

                    // Both controls carry stable element ids, so they are addressed by id rather
                    // than by their visible text, which is localized.
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

                case "screenshot":
                {
                    const file = path.join(ARTIFACT_DIR, `${agentName}-${action.name || index}.png`);
                    const buffer = await page.screenshot({ path: file, fullPage: false });
                    record.file = file;
                    // A screenshot is only evidence if somebody looks at it, and the one failure
                    // that does not need looking at is the blank one: a room that rendered nothing
                    // compresses to almost nothing, while a room that rendered is a photograph of
                    // a 3D scene and cannot. So the size is reported as a first reading, and the
                    // image is still there to be read properly.
                    record.bytes = buffer.length;
                    break;
                }

                case "wait":
                    await sleep(action.ms || 1000);
                    break;

                case "end":
                {
                    // Closing the browser without this leaves the player in the room until the
                    // server's stale-socket sweep notices, which shows up on staging as ghost
                    // players and would be misread as a bug by the next run.
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

    await context.close();
    await browser.close();

    return {
        agent: agentName,
        baseURL,
        finishedAt: new Date().toISOString(),
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
