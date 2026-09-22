// Drives the game the way a person does: real pointer and key input on the canvas and HUD, so tap
// arbitration, raycasts and permission checks all run. Aim comes from the page (AutomationBridgeUtil,
// read-only); input happens here. Clicks fail silently (out of reach, occluded, mid-drag), so every aim
// is verified against the page first, and a failed aim reports which failure it was.

const BRIDGE = "__thingspool_automation";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Reaching the bridge ────────────────────────────────────────────────

async function hasBridge(page)
{
    return page.evaluate((name) => typeof window[name] === "object" && window[name] !== null, BRIDGE);
}

// The bridge exists only on non-public deployments; its absence means the page is still booting or the
// build lacks it.
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

// Waits until the client is in a room with its contents spawned.
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

// A target is named by whichever properties the caller knows:
//
//   {objectId: "entrance_door"}                     — by identity
//   {objectType: "Door"}                            — the nearest one of a kind
//   {objectType: "Door", metadata: {Label: "Attic"}} — by what it carries
//   {objectType: "Canvas", index: 2}                — by position in the room's own order
//
// Metadata is matched on the shared enum's key names.
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
    // Nearest first, so a bare {objectType} names the closest one.
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

// A press and release without moving; a press that moves is read as steering the view, and the click is
// discarded.
async function tap(page, x, y)
{
    await page.mouse.move(x, y);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.up();
    await sleep(120);
}

// A tap meant to change the selection. Tapping what's already selected deselects it (ending edit mode);
// that's reported as its own outcome.
async function tapToSelect(page, x, y)
{
    const before = await call(page, "selection");
    const hadSelection = before.object != null || before.voxelQuad != null || before.player != null;

    await tap(page, x, y);
    await sleep(400);
    const after = await call(page, "selection");
    const nowEmpty = after.object == null && after.voxelQuad == null && after.player == null;

    if (JSON.stringify(after) !== JSON.stringify(before))
        return { outcome: (hadSelection && nowEmpty) ? "deselected" : "selected", selection: after };
    return { outcome: nowEmpty ? "nothing" : "selected", selection: after };
}

// ─── The mode a scenario is being carried out in ────────────────────────

async function gameMode(page)
{
    return (await call(page, "context")).gameMode;
}

// Waits for the page to report the mode. No panel proves it: edit mode opens on whatever the camera
// faces (see GameModeUtil).
async function waitForGameMode(page, mode, timeout = 10_000)
{
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout)
    {
        if (await gameMode(page) === mode) return;
        await sleep(150);
    }
    throw new Error(`The game did not get into ${mode} mode within ${timeout}ms.`);
}

// Enters edit mode via the top bar's switch unless already there.
async function ensureEditMode(page, timeout = 10_000)
{
    if (await gameMode(page) === "edit")
        return false;

    await ui.locator(page, "gameModeToggleSwitch").click({timeout});
    await waitForGameMode(page, "edit", timeout);
    return true;
}

// Drags across the canvas to turn the view, in small steps (the drag accumulates movement per frame).
async function orbit(page, dx, dy, options = {})
{
    const steps = options.steps ?? 12;
    const {canvas} = await call(page, "camera");
    const {x: startX, y: startY} = await orbitStartPoint(page, canvas);

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

// Pointer travel (px) kept between a drag's start and the selection outline's corners.
const ORBIT_CLEARANCE_PX = 40;

// The canvas's middle, unless the selected object's outline covers it: in edit mode the orbit frames the
// selection there, and a drag that starts on the outline moves the object instead of the view. Then it
// starts midway between the outline and whichever canvas edge leaves the most room.
async function orbitStartPoint(page, canvas)
{
    const middle = {x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2};
    let gizmo = null;
    try
    {
        gizmo = await call(page, "selectionGizmo");
    }
    catch
    {
        return middle; // A build from before the op: it has no outline drags either.
    }
    if (gizmo == null || gizmo.corners.length == 0)
        return middle;

    const xs = gizmo.corners.map(c => c.x);
    const ys = gizmo.corners.map(c => c.y);
    const box = {
        left: Math.min(...xs) - ORBIT_CLEARANCE_PX, right: Math.max(...xs) + ORBIT_CLEARANCE_PX,
        top: Math.min(...ys) - ORBIT_CLEARANCE_PX, bottom: Math.max(...ys) + ORBIT_CLEARANCE_PX,
    };
    if (middle.x < box.left || middle.x > box.right || middle.y < box.top || middle.y > box.bottom)
        return middle;

    const canvasRight = canvas.left + canvas.width;
    const canvasBottom = canvas.top + canvas.height;
    const sides = [
        {room: box.left - canvas.left, point: {x: (canvas.left + box.left) / 2, y: middle.y}},
        {room: canvasRight - box.right, point: {x: (box.right + canvasRight) / 2, y: middle.y}},
        {room: box.top - canvas.top, point: {x: middle.x, y: (canvas.top + box.top) / 2}},
        {room: canvasBottom - box.bottom, point: {x: middle.x, y: (box.bottom + canvasBottom) / 2}},
    ];
    const roomiest = sides.reduce((best, side) => side.room > best.room ? side : best);
    return roomiest.room > 0 ? roomiest.point : middle;
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

// Holds movement keys ("KeyW", "ArrowLeft", …); several at once walk diagonally.
async function walk(page, keys, durationMs = 500)
{
    const held = Array.isArray(keys) ? keys : [keys];
    for (const key of held) await page.keyboard.down(key);
    await sleep(durationMs);
    for (const key of held) await page.keyboard.up(key);
    await sleep(250); // Let the last of the movement settle before anything is measured.
}

// ─── Aiming, and the reasons an aim fails ───────────────────────────────

// Whether clicking this object's pixel would reach it, and if not, which silent failure is in the way
// (reach is read from the page, since it varies with the view).
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
    // The cast reaches it, but HUD over the canvas takes the click. Checked last, since moving the camera
    // can't fix it.
    if (report.overCanvas === false)
        return `covered by ${report.coveredBy}, which would take the click instead`;
    return null;
}

// Drag distance to bring something this many pixels off-center to the middle. A drag carries on-screen
// content the opposite way, at roughly seven screen pixels per drag pixel.
function steerDrag(offsetFromCentre)
{
    const drag = offsetFromCentre * 0.13;
    return Math.max(-200, Math.min(200, drag));
}

// Brings a target within reach by turning towards it and walking at it (real input, so unreachable is a
// finding). Finding and walking have separate budgets, so a long search can't starve the walk.
async function approach(page, target, options = {})
{
    // Narrower than the field of view, so a sweep can't step over the target.
    const orbitStep = options.orbitStep ?? 100;
    const sweepLimit = options.sweepLimit ?? 14; // Comfortably more than one revolution at that step.
    const closeLimit = options.closeLimit ?? 12;
    const rounds = options.rounds ?? 3;

    // Every step's report, carried with any error so a failed approach is readable without a rerun.
    const steps = [];
    const note = (move) => steps.push({
        move,
        fov: report.inFieldOfView, los: report.inLineOfSight, range: report.withinSelectRange,
        over: report.overCanvas, by: report.coveredBy,
        x: report.screen == null ? null : Math.round(report.screen.x),
        dist: Number(report.distance.toFixed(1)),
    });

    let report = await find(page, target);
    note("start");

    for (let round = 0; round < rounds; round++)
    {
        // Sweep blindly in one direction until in view: projected coordinates are meaningless outside the
        // frustum, and steering by them oscillates forever. One revolution must pass the target.
        for (let turn = 0; turn < sweepLimit && !report.inFieldOfView; turn++)
        {
            await orbit(page, orbitStep, 0);
            report = await find(page, target);
            note(`sweep ${orbitStep}`);
        }
        if (!report.inFieldOfView)
            break; // A whole revolution found nothing, and turning further is the same revolution.

        // Then deal with whatever is still in the way, which is not always distance.
        for (let step = 0; step < closeLimit; step++)
        {
            const problem = diagnose(report);
            if (problem == null)
                return report;
            if (!report.inFieldOfView)
                break; // Walked past it or turned off it; the next round finds it again.

            const {canvas} = await call(page, "camera");
            const offsetFromCentre = report.screen.x - (canvas.left + canvas.width / 2);

            if (!report.withinSelectRange || !report.inLineOfSight)
            {
                // Too far or occluded: walk, steering to keep the target ahead.
                if (Math.abs(offsetFromCentre) > canvas.width * 0.15)
                    await orbit(page, steerDrag(offsetFromCentre), 0);
                await walk(page, "KeyW", options.walkMs ?? 700);
                report = await find(page, target);
                note("steer + walk");
                continue;
            }
            else
            {
                // In reach and in sight but unclickable, so the HUD covers it. The HUD hugs the edges, so
                // turn (walking would carry the target out of reach).
                if (Math.abs(offsetFromCentre) < canvas.width * 0.05)
                    break; // Already central and still covered: turning cannot move what is there.
                await orbit(page, steerDrag(offsetFromCentre), 0);
                report = await find(page, target);
                note("steer off the HUD");
            }
        }
    }

    const error = new Error(
        `Could not get within reach of ${JSON.stringify(target)} after ${rounds} rounds of looking — ` +
        `${diagnose(report)}. A player would be stuck here too.`);
    error.steps = steps;
    throw error;
}

// ─── Clicking things in the world ───────────────────────────────────────

// Clicks an object where it is, verifying the exact pixel against the page first; a click that would hit
// something else is refused, naming what's in the way.
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

    // `select: false` for clicks not meant to select (walking through a door).
    const tapped = options.select === false
        ? (await tap(page, report.screen.x, report.screen.y), {})
        : await tapToSelect(page, report.screen.x, report.screen.y);
    return { ...report, ...tapped };
}

// Clicks a room surface (wall, floor, block face) to place things on it. Some quads refuse selection
// (e.g. undrawn ones near the camera), so candidates are tried in turn, reporting refusals if none take.
async function clickSurface(page, options = {})
{
    const hits = await call(page, "probeGrid", options.grid);
    let candidates = hits
        // Pixels under the HUD (common in edit mode) never receive the pointer.
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

        // Tapping the selected patch deselects it and ends edit mode, so the mode is restored before the
        // next candidate.
        if (tapped.outcome === "deselected" && startingMode === "edit")
            await ensureEditMode(page);
    }

    throw new Error(
        `None of the ${attempts} surfaces tried could be picked out. The nearest was ` +
        `${candidates[0].objectType} at ${candidates[0].distance.toFixed(1)} away. A surface that is ` +
        `not currently drawn refuses selection, which is what culling near the camera produces.`);
}

// Moves the search makes between views: widen the view first (free), then cover ground.
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

// Spreads attempts evenly across the near-to-far candidates: the nearest surfaces (floor, low blocks)
// rarely accept wall-hung things.
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

// Selects surfaces until the control `elementId` is enabled for the selection, reporting how many were
// refused (telling "nowhere to put one" from a broken tool).
async function clickSurfaceUntilEnabled(page, elementId, options = {})
{
    const maxPerView = options.maxAttempts ?? 12;
    const moves = options.moves ?? DEFAULT_SEARCH_MOVES;
    const views = options.views ?? Math.min(moves.length + 1, 4);
    const tried = [];

    // The search must stay in its starting mode (the awaited control lives there); moves and taps can end it.
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
                // This tap deselected the already-selected patch (ending edit mode); restore the mode first.
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
                // Absent, not disabled: the app doesn't offer this action here (the user's role, or the mode ended).
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

// The selection confirms a world click worked and drives the HUD, so waiting on it joins the two.
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
// Selection-driven DOM with stable ids: no aiming needed, but controls mount, unmount and disable with
// the selection, so clicks wait and check.

const ui =
{
    locator: (page, elementId) => page.locator(`#${elementId}`),

    async waitFor(page, elementId, options = {})
    {
        await ui.locator(page, elementId).waitFor({state: "visible", timeout: options.timeout ?? 5000});
    },

    // Reads `aria-disabled`: these controls are divs, so Playwright's isEnabled reports them all enabled.
    async isEnabled(page, elementId)
    {
        const locator = ui.locator(page, elementId);
        if (await locator.count() === 0) return false;
        if (!(await locator.isEnabled())) return false; // Real form controls still answer here.
        return (await locator.getAttribute("aria-disabled")) !== "true";
    },

    // A disabled control is the app refusing (usually what's under test), so it's reported as such.
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
    gameMode, waitForGameMode, ensureEditMode,
    clickObject, clickSurface, clickSurfaceUntilEnabled, waitForSelection,
    ui, sleep,
};
