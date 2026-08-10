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
//   - It does not open the room-list popup, which in-game is opened by interacting with a door
//     object whose position varies per generated room. Screenshots cover whether the client
//     rendered; the request-context checks cover whether the data behind it is right.
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
        viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 500)); });
    page.on("pageerror", err => pageErrors.push(String(err).substring(0, 500)));

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
                    const response = await page.goto(`${baseURL}/`, { waitUntil: "networkidle", timeout: 60_000 });
                    record.status = response?.status() ?? 0;
                    if (record.status === 429) rateLimitHits++;
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
                    await page.screenshot({ path: file, fullPage: false });
                    record.file = file;
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
