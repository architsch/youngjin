// Driving the game the way a person does: real gestures on the canvas, real clicks on the HUD.
//
// Two things have to be true at once for an automated run to prove anything. The gesture has to be
// a real one — a pointer that presses and releases on the canvas, a key that goes down and comes up
// — so that everything between the browser and the object's own handler actually runs: the tap
// arbitration that tells a click from a drag, the raycast, the permission check inside whatever was
// hit. And the gesture has to land where it was aimed, which nothing on the Playwright side can
// know, because where anything in a room falls on screen depends on the room that was generated.
//
// So the aim comes from the page (AutomationBridgeUtil, which only ever answers questions) and the
// act happens here (which only ever produces input). Neither half can shortcut the other: this file
// has no way to select an object except by clicking on it, and the bridge has no way to click.
//
// The failures this is built around are the quiet ones. A click on something out of reach is read
// as a click on nothing; a click on something standing behind a wall hits the wall; a click during
// a drag is not a click at all. Each of those does exactly nothing and reports exactly nothing, so
// every aim here is verified against the page before the gesture is made, and an aim that cannot be
// made to work comes back saying which of those it was.

const BRIDGE = "__thingspool_automation";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Reaching the bridge ────────────────────────────────────────────────

async function hasBridge(page)
{
    return page.evaluate((name) => typeof window[name] === "object" && window[name] !== null, BRIDGE);
}

// The bridge is installed on a deployment that is not the public site, so its absence is nearly
// always one of two things worth telling apart: the page has not finished booting, or this is a
// build that does not carry it.
async function waitForBridge(page, timeout = 30_000)
{
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout)
    {
        if (await hasBridge(page)) return true;
        await sleep(250);
    }
    throw new Error(
        `The automation bridge (window.${BRIDGE}) never appeared. Either the page did not finish ` +
        `loading within ${timeout}ms, or this build was served by the public site, which does not ` +
        `install it.`);
}

async function call(page, method, ...args)
{
    return page.evaluate(({name, method, args}) => window[name][method](...args),
        {name: BRIDGE, method, args});
}

// Waits until the client has actually been placed in a room and its contents have spawned, which is
// the point from which anything is there to aim at.
async function waitForRoom(page, timeout = 45_000)
{
    await waitForBridge(page, timeout);
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout)
    {
        const state = await call(page, "ready");
        if (state.room && state.myPlayer) return state;
        await sleep(300);
    }
    throw new Error(`No room was entered within ${timeout}ms.`);
}

// ─── Choosing what to aim at ────────────────────────────────────────────

// A target is named by whichever of its properties the caller actually knows:
//
//   {objectId: "entrance_door"}                     — by identity
//   {objectType: "Door"}                            — the nearest one of a kind
//   {objectType: "Door", metadata: {Label: "Attic"}} — by what it carries
//   {objectType: "Canvas", index: 2}                — by position in the room's own order
//
// Metadata is matched on the key names the shared enum gives, so this file needs to know nothing
// about what any of them mean.
function matches(report, target)
{
    if (target.objectId != null && report.objectId !== target.objectId) return false;
    if (target.objectType != null && report.objectType !== target.objectType) return false;
    for (const [key, value] of Object.entries(target.metadata || {}))
    {
        if ((report.metadata || {})[key] !== String(value)) return false;
    }
    return true;
}

async function findAll(page, target)
{
    const reports = await call(page, "objects", target.objectType);
    const found = reports.filter(report => matches(report, target));
    if (target.index != null)
        return found[target.index] == null ? [] : [found[target.index]];
    // Nearest first, so a bare {objectType} names the one the player is standing closest to — which
    // is the one a person would have meant.
    return found.sort((a, b) => a.distance - b.distance);
}

async function find(page, target)
{
    const found = await findAll(page, target);
    if (found.length === 0)
    {
        const present = await call(page, "objects");
        throw new Error(
            `No object matched ${JSON.stringify(target)}. The room holds: ` +
            `${present.map(o => `${o.objectType}#${o.objectId}`).join(", ") || "(nothing)"}.`);
    }
    return found[0];
}

// ─── Gestures ───────────────────────────────────────────────────────────

// One tap: the pointer arrives, presses, and releases without travelling. The stillness is the
// point — a press and release that moved is read as the user steering the view, and the click is
// discarded rather than being applied to whatever the pointer came to rest on.
async function tap(page, x, y)
{
    await page.mouse.move(x, y);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.up();
    await sleep(120);
}

// A tap on the room, made where the point of it is to change what is picked out.
//
// Two things happen to such a tap that look identical from outside, and telling them apart is the
// whole job here.
//
// A control hanging off the current selection — the character's own options, a color palette — puts
// itself away when the room behind it is tapped, and *spends* the tap doing so, so that the user who
// meant to close the control does not lose the selection along with it. That tap never reaches the
// canvas: the pixel is over the canvas, the cast through it meets the wall, and nothing happens. A
// tap that changed nothing is therefore given one more attempt, and only one — a second silent tap
// means something other than this.
//
// Tapping what is *already* picked out is the opposite case: it is how a selection is let go of, so
// the tap lands and the answer to it is that there is now no selection. Retrying that would pick the
// same thing straight back up and leave no trace of what happened in between — and in edit mode what
// happens in between is that the mode ends, because the mode is the selection. So it is reported
// rather than undone, and the caller decides what to do about it.
async function tapToSelect(page, x, y)
{
    const before = await call(page, "selection");
    const hadSelection = before.object != null || before.voxelQuad != null || before.player != null;

    await tap(page, x, y);
    await sleep(400);
    let after = await call(page, "selection");

    if (JSON.stringify(after) !== JSON.stringify(before))
    {
        const nowEmpty = after.object == null && after.voxelQuad == null && after.player == null;
        return { taps: 1, firstTapSpent: false,
            outcome: (hadSelection && nowEmpty) ? "deselected" : "selected", selection: after };
    }

    await tap(page, x, y);
    await sleep(400);
    after = await call(page, "selection");
    const nowEmpty = after.object == null && after.voxelQuad == null && after.player == null;
    return { taps: 2, firstTapSpent: true,
        outcome: nowEmpty ? "nothing" : "selected", selection: after };
}

// ─── The mode a scenario is being carried out in ────────────────────────

async function gameMode(page)
{
    return (await call(page, "context")).gameMode;
}

// Puts the app back into edit mode after something dropped it out.
//
// Worth a helper rather than a line in the caller, because edit mode is not a place the app stays
// put: it is held up by whatever is picked out, and letting that go ends it (see GameModeUtil). A
// run that tries surfaces one after another lets a selection go every time it taps one it already
// had, so falling out of the mode is an ordinary event on the way rather than a fault.
//
// There are two ways back in and they are not interchangeable. With something already picked out the
// app offers to open the mode on that, which keeps it; with nothing picked out the mode is entered
// on the user's own character instead.
async function ensureEditMode(page, timeout = 10_000)
{
    if (await gameMode(page) === "edit")
        return false;

    const resume = ui.locator(page, "startEditingButton");
    if (await resume.count() > 0)
        await resume.click({timeout});
    else
    {
        await ui.locator(page, "editModeButton").click({timeout});
        await page.locator("#customizePlayerOptions").waitFor({state: "visible", timeout});
    }

    await sleep(300);
    if (await gameMode(page) !== "edit")
        throw new Error("Could not get back into edit mode after the selection was let go of.");
    return true;
}

// Dragging across the canvas is how the view is turned, which is the only way to bring something
// into sight that is behind the camera or off to one side. Deliberately made of several small
// steps: one jump would be a teleport, and the drag reading accumulates movement per frame.
async function orbit(page, dx, dy, options = {})
{
    const steps = options.steps ?? 12;
    const {canvas} = await call(page, "camera");
    const startX = canvas.left + canvas.width / 2;
    const startY = canvas.top + canvas.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= steps; step++)
    {
        await page.mouse.move(startX + (dx * step) / steps, startY + (dy * step) / steps);
        await sleep(16);
    }
    await page.mouse.up();
    await sleep(150);
}

async function zoom(page, deltaY, options = {})
{
    const steps = options.steps ?? 4;
    const {canvas} = await call(page, "camera");
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let step = 0; step < steps; step++)
    {
        await page.mouse.wheel(0, deltaY / steps);
        await sleep(60);
    }
    await sleep(150);
}

// Walking. `keys` is anything the movement controls accept ("KeyW", "ArrowLeft", …); several at
// once walk diagonally, exactly as holding both would.
async function walk(page, keys, durationMs = 500)
{
    const held = Array.isArray(keys) ? keys : [keys];
    for (const key of held) await page.keyboard.down(key);
    await sleep(durationMs);
    for (const key of held) await page.keyboard.up(key);
    await sleep(250); // Let the last of the movement settle before anything is measured.
}

// ─── Aiming, and the reasons an aim fails ───────────────────────────────

// Whether the pixel this object occupies would actually reach it, and if not, which of the several
// silent failures is in the way. Everything that decides this is read from the page rather than
// assumed, including how far the reach extends — that distance changes with the view.
function diagnose(report)
{
    if (report.screen == null)
        return "behind the camera";
    if (!report.inFieldOfView)
        return "outside the camera's field of view";
    if (!report.inLineOfSight)
        return "hidden behind something";
    if (!report.withinSelectRange)
        return `out of reach (${report.distance.toFixed(1)} away)`;
    // The cast reaches it but the pointer would not: something drawn over the canvas takes the
    // click first. Last, because it is the only one of these that moving the camera cannot fix.
    if (report.overCanvas === false)
        return `covered by ${report.coveredBy}, which would take the click instead`;
    return null;
}

// Brings a target within reach, by turning towards it and then walking at it. Both are ordinary
// input, so a target that cannot be reached this way is one a player could not reach either — which
// is a finding rather than a harness problem, and is reported as one.
async function approach(page, target, options = {})
{
    const maxAttempts = options.maxAttempts ?? 6;
    let report = await find(page, target);

    for (let attempt = 0; attempt < maxAttempts; attempt++)
    {
        const problem = diagnose(report);
        if (problem == null) return report;

        if (report.screen == null || !report.inFieldOfView)
        {
            // Nothing to walk towards until it is in view, so turn first.
            await orbit(page, options.orbitStep ?? 220, 0);
        }
        else if (!report.withinSelectRange || !report.inLineOfSight)
        {
            // Steer so the target is ahead, then close the distance. Walking is what changes both
            // the range and what is standing in the way.
            const {canvas} = await call(page, "camera");
            const offsetFromCentre = report.screen.x - (canvas.left + canvas.width / 2);
            if (Math.abs(offsetFromCentre) > canvas.width * 0.15)
                await orbit(page, -offsetFromCentre * 0.6, 0);
            await walk(page, "KeyW", options.walkMs ?? 600);
        }

        report = await find(page, target);
    }

    throw new Error(
        `Could not get within reach of ${JSON.stringify(target)} after ${maxAttempts} attempts — ` +
        `${diagnose(report)}. A player would be stuck here too.`);
}

// ─── Clicking things in the world ───────────────────────────────────────

// Clicks an object where it actually is. The aim is checked against the page immediately before the
// gesture — a cast through the very pixel about to be pressed — so a click that would have hit
// something else is refused with the name of what is in the way, rather than being made and
// reported as having done nothing.
async function clickObject(page, target, options = {})
{
    let report = options.approach === false
        ? await find(page, target)
        : await approach(page, target, options);

    const problem = diagnose(report);
    if (problem != null)
        throw new Error(`Cannot click ${JSON.stringify(target)} — it is ${problem}.`);

    const hit = await call(page, "probe", report.screen.x, report.screen.y);
    if (hit == null)
        throw new Error(`Aimed at ${JSON.stringify(target)} but the pixel is over nothing.`);
    if (!hit.overCanvas)
        throw new Error(
            `Aimed at ${report.objectType}#${report.objectId}, but ${hit.coveredBy} is drawn over ` +
            `that pixel and would take the click instead.`);
    if (hit.objectId !== report.objectId)
        throw new Error(
            `Aimed at ${report.objectType}#${report.objectId} but ${hit.objectType || "unowned geometry"}` +
            `${hit.objectId ? `#${hit.objectId}` : ""} is in front of it at that pixel.`);
    if (!hit.withinSelectRange)
        throw new Error(
            `Aimed at ${report.objectType}#${report.objectId}, which is ${hit.distance.toFixed(1)} ` +
            `away — beyond the reach a click has.`);

    // `select: false` for a click whose point is not to pick the thing out — walking through a door
    // rather than taking hold of one — where a second attempt would be a second journey.
    const tapped = options.select === false
        ? (await tap(page, report.screen.x, report.screen.y), {taps: 1, firstTapSpent: false})
        : await tapToSelect(page, report.screen.x, report.screen.y);
    return { ...report, ...tapped };
}

// Clicks a patch of the room itself — a wall, a floor, the face of a block — which is how anything
// hung on a surface is placed.
//
// Not every patch of room that a ray meets can actually be picked out, and the reasons are the
// room's own business rather than something worth reproducing out here: a quad that is not currently
// drawn refuses the selection, and the surfaces nearest the camera are the likeliest to be in that
// state, since those are the ones culled to keep the view of whatever is being edited clear. So
// candidates are tried in turn until one takes, which needs no theory about why the others did not,
// and reports how many were refused when none of them takes at all.
async function clickSurface(page, options = {})
{
    const hits = await call(page, "probeGrid", options.grid);
    let candidates = hits
        // A pixel under the HUD is one the pointer never reaches, however plainly the cast through
        // it meets a wall. In edit mode — which is when surfaces are being clicked at all — the
        // HUD covers a good part of the view, so this is a common reason a grid point is unusable.
        .filter(hit => hit.overCanvas)
        .filter(hit => hit.withinSelectRange)
        .filter(hit => (options.objectType == null ? true : hit.objectType === options.objectType))
        .filter(hit => (options.filter == null ? true : options.filter(hit)))
        .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0)
    {
        const covered = hits.filter(h => !h.overCanvas);
        throw new Error(
            `No reachable surface in view matched. ${hits.length} points were struck; ` +
            `${hits.filter(h => h.withinSelectRange).length} were within reach, and ${covered.length} ` +
            `were covered by the UI (${[...new Set(covered.map(h => h.coveredBy))].join(", ") || "none"}).`);
    }

    if (options.pick != null)
        candidates = [options.pick(candidates)];

    const startingMode = await gameMode(page);
    const attempts = Math.min(candidates.length, options.maxAttempts ?? 6);
    for (let attempt = 0; attempt < attempts; attempt++)
    {
        const chosen = candidates[attempt];
        const before = await call(page, "selection");
        const tapped = await tapToSelect(page, chosen.screen.x, chosen.screen.y);
        const after = await call(page, "selection");

        if (after.voxelQuad != null && JSON.stringify(after.voxelQuad) !== JSON.stringify(before.voxelQuad))
            return { ...chosen, ...tapped, attempts: attempt + 1 };

        // Tapping the patch already picked out lets it go, and in edit mode the mode goes too. The
        // next candidate has to be tried from the mode this one started in, not from play mode.
        if (tapped.outcome === "deselected" && startingMode === "edit")
            await ensureEditMode(page);
    }

    throw new Error(
        `None of the ${attempts} surfaces tried could be picked out. The nearest was ` +
        `${candidates[0].objectType} at ${candidates[0].distance.toFixed(1)} away. A surface that is ` +
        `not currently drawn refuses selection, which is what culling near the camera produces.`);
}

// Picks out surfaces in turn until the one selected is a surface the app will actually do the thing
// on — named by the control that offers it, which is enabled or disabled per selection.
//
// Selecting a surface and finding the tool for it greyed out is not a failure: most of a room is
// wall that will not take a door, floor that will not take a picture, block that cannot be built
// against. Which patch will is a question only the app can answer, and it answers it by enabling the
// control. So this asks it, once per candidate, and reports how many patches were offered and
// refused — which is the difference between "this room has nowhere to put one" and "the tool is
// broken", the two readings the same symptom otherwise has.
// Where a room is not offering what is being looked for anywhere in sight, a person does not stand
// still and squint — he goes and looks somewhere else. These are the moves the search makes between
// views, in order: widen the view first, since that is free and often enough, then cover ground.
const DEFAULT_SEARCH_MOVES = [
    async (page) => { await zoom(page, -400); },
    async (page) => { await orbit(page, 0, 150); },
    async (page) => { await walk(page, "KeyW", 1200); },
    async (page) => { await orbit(page, 700, 0); },
    async (page) => { await walk(page, "KeyA", 1200); },
    async (page) => { await orbit(page, 700, -150); },
    async (page) => { await walk(page, "KeyW", 1600); },
    async (page) => { await orbit(page, 700, 150); },
];

// Which of the candidates to actually try, when there are more of them than there are attempts.
//
// Taking the nearest few is the obvious choice and the wrong one. What is nearest to a player
// standing in a room is the floor under him and the low blocks around him, and those are the very
// surfaces least likely to take anything: a thing hung on a wall needs wall behind it over its whole
// height. The surfaces that qualify are further off and higher up, and a search that spends every
// attempt on the closest cluster never reaches one — it reports the room as having nowhere while
// standing a few paces from somewhere.
//
// So the attempts are spread evenly across the whole ordered set instead, near to far.
function spread(candidates, count)
{
    if (candidates.length <= count)
        return candidates;
    if (count <= 1)
        return candidates.slice(0, count);

    const picked = [];
    for (let i = 0; i < count; i++)
        picked.push(candidates[Math.round((i * (candidates.length - 1)) / (count - 1))]);
    return picked;
}

async function clickSurfaceUntilEnabled(page, elementId, options = {})
{
    const maxPerView = options.maxAttempts ?? 12;
    const moves = options.moves ?? DEFAULT_SEARCH_MOVES;
    const views = options.views ?? Math.min(moves.length + 1, 4);
    const tried = [];

    // The mode the search begins in is the mode it has to stay in: the control being waited on lives
    // there, and every one of the moves below can end it — walking is a movement key, and tapping a
    // surface that is already picked out lets the selection the mode stands on go.
    const startingMode = await gameMode(page);

    for (let view = 0; view < views; view++)
    {
        if (view > 0)
        {
            await moves[(view - 1) % moves.length](page);
            if (startingMode === "edit")
                await ensureEditMode(page);
        }

        const hits = await call(page, "probeGrid", options.grid ?? {cols: 11, rows: 9, margin: 0.06});
        const candidates = hits
            .filter(hit => hit.overCanvas)
            .filter(hit => hit.withinSelectRange)
            .filter(hit => (options.objectType == null ? true : hit.objectType === options.objectType))
            .sort((a, b) => a.distance - b.distance);

        const chosenCandidates = spread(candidates, maxPerView);
        for (const chosen of chosenCandidates)
        {
            const before = await call(page, "selection");
            const tapped = await tapToSelect(page, chosen.screen.x, chosen.screen.y);
            const after = await call(page, "selection");

            if (tapped.outcome === "deselected")
            {
                // The patch under this grid point is the one already picked out, so the tap let it
                // go — and in edit mode the mode went with it. Nothing was learnt about the patch
                // that is not already known, but the mode has to be recovered before the next one.
                tried.push({...chosen, view, outcome: "already picked out"});
                if (startingMode === "edit")
                    await ensureEditMode(page);
                continue;
            }

            if (after.voxelQuad == null ||
                JSON.stringify(after.voxelQuad) === JSON.stringify(before.voxelQuad))
            {
                tried.push({...chosen, view, outcome: "not selectable"});
                continue;
            }

            if ((await ui.locator(page, elementId).count()) === 0)
            {
                // Absent rather than disabled, which is a different answer: the app is not offering
                // this action here at all — because of who the user is, or because the mode the
                // control belongs to is no longer the mode being stood in.
                tried.push({...chosen, view, quad: after.voxelQuad,
                    mode: await gameMode(page), outcome: `#${elementId} not present`});
                if (startingMode === "edit")
                    await ensureEditMode(page);
                continue;
            }

            if (await ui.isEnabled(page, elementId))
                return {...chosen, quad: after.voxelQuad, attempts: tried.length + 1, views: view + 1, tried};

            tried.push({...chosen, view, quad: after.voxelQuad, outcome: `#${elementId} disabled`});
        }
    }

    const summary = tried.reduce((counts, t) => {
        counts[t.outcome] = (counts[t.outcome] || 0) + 1;
        return counts;
    }, {});
    const error = new Error(
        `Tried ${tried.length} surfaces across ${views} views and #${elementId} was never enabled: ` +
        `${Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(", ")}.`);
    error.tried = tried;
    throw error;
}

// ─── Confirming that a gesture landed ───────────────────────────────────

// What the app holds selected is the one thing that says a world click did what it was meant to,
// and it is also what raises the HUD driven next — so waiting on it is the join between the two
// halves of any scenario.
async function waitForSelection(page, predicate, options = {})
{
    const timeout = options.timeout ?? 5000;
    const startedAt = Date.now();
    let selection = null;
    while (Date.now() - startedAt < timeout)
    {
        selection = await call(page, "selection");
        if (predicate(selection)) return selection;
        await sleep(200);
    }
    throw new Error(
        `The expected selection never appeared within ${timeout}ms. ` +
        `Current selection: ${JSON.stringify(selection)}.`);
}

// ─── The HUD ────────────────────────────────────────────────────────────
//
// Everything raised by a selection is ordinary DOM carrying a stable element id, so it needs none
// of the aiming above. What it does need is the waiting: these controls are mounted and unmounted
// by the selection beneath them, and a disabled one looks exactly like an enabled one to a click
// that does not check.

const ui =
{
    locator: (page, elementId) => page.locator(`#${elementId}`),

    async waitFor(page, elementId, options = {})
    {
        await ui.locator(page, elementId).waitFor({state: "visible", timeout: options.timeout ?? 5000});
    },

    // Whether the app is currently offering this control, which is not the same question Playwright's
    // own isEnabled answers. These controls are divs rather than form elements, so they carry no
    // `disabled` property for it to read and it calls every one of them enabled — including the ones
    // drawn greyed out with their handler taken off. The refusal is stated in `aria-disabled`, and
    // that is what has to be read.
    async isEnabled(page, elementId)
    {
        const locator = ui.locator(page, elementId);
        if (await locator.count() === 0) return false;
        if (!(await locator.isEnabled())) return false; // Real form controls still answer here.
        return (await locator.getAttribute("aria-disabled")) !== "true";
    },

    // A control that is present but disabled is the app refusing, and that refusal is usually the
    // thing under test — so it is reported as itself rather than as a click that failed.
    async click(page, elementId, options = {})
    {
        const locator = ui.locator(page, elementId);
        await locator.waitFor({state: "visible", timeout: options.timeout ?? 5000});
        if (!(await ui.isEnabled(page, elementId)))
            throw new Error(`#${elementId} is present but disabled — the app is refusing this action.`);
        await locator.click();
        await sleep(options.settleMs ?? 250);
    },

    async fill(page, selector, text)
    {
        const locator = page.locator(selector);
        await locator.waitFor({state: "visible", timeout: 5000});
        await locator.fill(text);
    },

    async exists(page, elementId)
    {
        return (await ui.locator(page, elementId).count()) > 0;
    },
};

module.exports = {
    BRIDGE,
    hasBridge, waitForBridge, waitForRoom, call,
    find, findAll, diagnose,
    tap, tapToSelect, orbit, zoom, walk, approach,
    gameMode, ensureEditMode,
    clickObject, clickSurface, clickSurfaceUntilEnabled, waitForSelection,
    ui, sleep,
};
