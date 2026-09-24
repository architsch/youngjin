// Arranges the scene a run acts in: where the player stands and where the camera looks from. The other
// half of interact.js, and the split is deliberate: this never clicks, selects or edits (a run that could
// place a door by asking proves nothing about placing doors). It saves the time and variance of walking.

const BRIDGE = "__thingspool_setup";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Placements and views apply on the next frame, so reads wait this long.
const SETTLE_MS = 250;

async function hasSetup(page)
{
    return page.evaluate((name) => typeof window[name] === "object" && window[name] !== null, BRIDGE);
}

// Absent while the page boots, or on public-site builds (like the read-only bridge).
async function waitForSetup(page, timeout = 30_000)
{
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout)
    {
        if (await hasSetup(page)) return true;
        await sleep(250);
    }
    throw new Error(
        `The setup bridge (window.${BRIDGE}) never appeared. Either the page did not finish ` +
        `loading within ${timeout}ms, or this build was served by the public site, which does not ` +
        `install it.`);
}

// Unwraps the bridge's error sentence from Playwright's wrapper, since it's how callers learn why a call
// failed.
async function call(page, method, ...args)
{
    try
    {
        return await page.evaluate(({name, method, args}) => window[name][method](...args),
            {name: BRIDGE, method, args});
    }
    catch (err)
    {
        const message = String(err && err.message ? err.message : err);
        const inner = message.match(/Error: ([^\n]+)/);
        throw new Error(`setup.${method} failed: ${inner ? inner[1] : message}`);
    }
}

// ─── Where the player is ────────────────────────────────────────────────

const pose = (page) => call(page, "pose");

// Every standable spot, nearest first, read from the room's grid. Two storeys can return the same cell
// twice; `collisionLayer` distinguishes them and narrows the result.
const standingSpots = (page, options) => call(page, "standingSpots", options || {});

// ─── Putting it where the shot needs it ─────────────────────────────────

/** Stands the player at a point, optionally facing another. Returns the pose actually reached (assert on that). */
async function place(page, x, z, options = {})
{
    const {faceX, faceZ, collisionLayer} = options;
    const result = await call(page, "place", x, z, {faceX, faceZ, collisionLayer});
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

/** Turns the player to face a point in the room, without moving him. */
async function face(page, x, z, options = {})
{
    const result = await call(page, "face", x, z);
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

/** The same turn as an absolute heading, in degrees clockwise from +Z. */
async function faceDeg(page, headingDeg, options = {})
{
    const result = await call(page, "faceDeg", headingDeg);
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

/**
 * Stands the player on the standable spot nearest a ring `distance` from a point, facing it (the usual
 * shot setup: the subject is rarely standable, and a subject in a corner still gets a vantage).
 */
async function vantage(page, target, options = {})
{
    const distance = options.distance === undefined ? 4 : options.distance;
    const spots = await standingSpots(page, {
        near: {x: target.x, z: target.z},
        collisionLayer: options.collisionLayer,
        limit: 200,
    });
    if (spots.length == 0)
        throw new Error(`Nowhere to stand anywhere near (${target.x}, ${target.z}).`);

    // Nearest to the ring, not the subject: standing on it isn't a view of it.
    let best = spots[0];
    let bestError = Infinity;
    for (const spot of spots)
    {
        const error = Math.abs(spot.distance - distance);
        if (error < bestError) { bestError = error; best = spot; }
    }

    return place(page, best.x, best.z, {
        collisionLayer: best.collisionLayer,
        faceX: target.x,
        faceZ: target.z,
        settleMs: options.settleMs,
    });
}

// ─── Where the camera looks from ────────────────────────────────────────

/**
 * Sets the orbit camera's view: `azimuthDeg` around the vertical, `polarDeg` from straight up, `zoom` from
 * 0 (farthest) to 1 (closest); omitted fields keep their values. The orbit belongs to edit mode; in play
 * mode the view applies when edit mode is next entered (call `Interact.ensureEditMode` first if needed).
 */
async function look(page, view, options = {})
{
    const result = await call(page, "look", view);
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

/** Holds the orbit on a point of the room rather than on whatever is selected. */
async function lookAt(page, x, y, z, options = {})
{
    const result = await call(page, "lookAt", x, y, z);
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

const clearLookAt = (page) => call(page, "clearLookAt");

/** The orbit's current view in `look`'s units, for swinging relative to where edit mode opened. */
const view = (page) => call(page, "view");

/** A swing relative to the view the mode opened at, which is the one a shot is usually composed as. */
async function swing(page, {azimuthDeg = 0, polarDeg, zoom} = {}, options = {})
{
    const current = await view(page);
    return look(page, {
        azimuthDeg: current.azimuthDeg + azimuthDeg,
        polarDeg: polarDeg === undefined ? current.polarDeg : polarDeg,
        zoom: zoom === undefined ? current.zoom : zoom,
    }, options);
}

// ─── The sandbox: building the set instead of finding one ───────────────
// An empty single-player room with a free camera, where a local run builds what it needs instead of
// going and finding it (see playtest/sandboxRunner.js). Only the set is staged: everything standing in
// it is spawned, drawn and lit by the real game.

/** Whether this page is in the sandbox, so a script can branch instead of failing on its first build. */
const sandboxActive = (page) => callSandbox(page, "active");

/**
 * Where the free camera stands and what it aims at, in world coordinates. Either may be given alone
 * (moving without re-aiming dollies or lifts the shot).
 */
async function camera(page, view_, options = {})
{
    const result = await callSandbox(page, "camera", view_);
    await sleep(options.settleMs === undefined ? SETTLE_MS : options.settleMs);
    return result;
}

/** Where the free camera is now, for composing off the view it already has. */
const cameraPose = (page) => callSandbox(page, "cameraPose");

/**
 * Stands a box of blocks: a corner cell (`row`, `col`, `collisionLayer`) and a size (`rows`, `cols`,
 * `layers`, each defaulting to one), finished in `textureIndex` of the room's pack.
 */
const addBlocks = (page, region) => callSandbox(page, "addBlocks", region);

/** Takes the same kind of box away again. */
const removeBlocks = (page, region) => callSandbox(page, "removeBlocks", region);

/**
 * Sets the texture pack, re-dressing everything standing. With no argument, reports the current pack and
 * those available.
 */
const texturePack = (page, path) => callSandbox(page, "texturePack", path);

/** The game's own `{floor, ceiling, wall, prop}` texture sets; dress sets from these rather than freehand indices. */
const palettes = (page, texturePackPath) => callSandbox(page, "palettes", texturePackPath);

/** The paintings a canvas can carry, each with its title and painter. */
const pictures = (page) => callSandbox(page, "pictures");

/**
 * The set's atmosphere (ambient light, head lamp, fog):
 *
 *   roomLighting({headLightPowerStep: 0})            // the room lit only by its own lamps
 *   roomLighting({fogColorIndex: 6, fogFarStep: 30}) // air the far wall recedes into
 *
 * Colors are palette positions; everything else is a step in [0, maxStep]. With no argument, reports the
 * current lighting, both palettes and the maximum.
 */
const roomLighting = (page, prefs) => callSandbox(page, "roomLighting", prefs);

/**
 * The door finishes, in the order the finish list shows them, ready to pass as metadata (otherwise a door's
 * finish is random per id):
 *
 *   const styles = await setup.doorStyles();
 *   addObject({type: "Door", ...wall, col: 14, metadata: {Label: "Cellar", ...styles[3]}})
 */
const doorStyles = (page) => callSandbox(page, "doorStyles");

/**
 * The canvas frames, in the order the frame list shows them (the first is no frame at all), ready to pass as
 * metadata (otherwise a canvas's frame is random per id):
 *
 *   const frames = await setup.canvasFrameStyles();
 *   addObject({type: "Canvas", ...wall, col: 14, metadata: {ImagePath: "1/14", ...frames[2]}})
 */
const canvasFrameStyles = (page) => callSandbox(page, "canvasFrameStyles");

/**
 * Attaches a picture, a door, a lamp or a label to a cell's face:
 *
 *   addObject({type: "Canvas", row, col, face: "-z", collisionLayer: 2, metadata: {ImagePath: "1/14"}})
 *   addObject({type: "Door", row, col, face: "+x", metadata: {Label: "Library"}})
 *   addObject({type: "Lamp", row, col, face: "+y", collisionLayer: -1})   // on the room's floor
 *   addObject({type: "Label", row, col, face: "-z", collisionLayer: 2, metadata: {Label: "Reading Room"}})
 *
 * `face` is `-x`, `+x`, `-z` or `+z` for a wall, where `collisionLayer` is the height on it, or `+y` / `-y`
 * for the top / underside of the block on `collisionLayer`; below the lowest layer is the room's floor, above
 * the highest its ceiling. Pictures, doors and labels go on walls only. A door ignores the layer and stands on the
 * floor unless given a `y`. Each goes up at the size the game adds it at (a lamp one layer tall; see
 * `resizeObject` for others). Metadata uses the game's key names; returns the object's id.
 */
const addObject = (page, spec) => callSandbox(page, "addObject", spec);

/**
 * Resizes a standing object, in multiples of its type's step (a canvas goes from 1 to its maxScale in
 * halves):
 *
 *   resizeObject({objectId, x: 2.5, y: 1.5})
 *
 * Any axis left out keeps its scale. The game's placement rule applies, so an object with no room to
 * grow into keeps the size it had; the returned scale and world size are what it ended up with.
 */
const resizeObject = (page, spec) => callSandbox(page, "resizeObject", spec);

/** Takes one down again, by the id `addObject` gave back. */
const removeObject = (page, objectId) => callSandbox(page, "removeObject", objectId);

/**
 * Replaces the room's restricted zones (full-height cell rectangles) and returns them; with no argument it
 * only reports:
 *
 *   restrictedZones([{rowMin: 14, rowMax: 21, colMin: 15, colMax: 22}])
 *
 * **Outlines are drawn in edit mode only.** Lay the zones, then `ctx.clickId("gameModeToggleSwitch")`;
 * the sandbox camera ignores the selection, so the composed frame survives.
 */
const restrictedZones = (page, zones) => callSandbox(page, "restrictedZones", zones);

/** Empties the set back to bare floor and puts the camera back, between one shot and the next. */
const clearSandbox = (page) => callSandbox(page, "clear");

/**
 * Stands a room: four walls around a floor rectangle. `open` names sides to omit (`["-z"]` for a room the
 * camera looks into), `layers` is wall height in collision layers, and `floorTextureIndex` lays a floor of
 * another material. Returns the inside rectangle.
 */
async function stage(page, spec)
{
    const {row, col, rows = 8, cols = 8, layers = 6,
        wallTextureIndex = 0, floorTextureIndex, open = []} = spec;

    if (floorTextureIndex !== undefined)
    {
        await addBlocks(page, {row, col, rows, cols, collisionLayer: 0, layers: 1,
            textureIndex: floorTextureIndex});
    }

    // A laid floor is a block layer on the room's own, so the walls start above it.
    const base = floorTextureIndex === undefined ? 0 : 1;
    const walls = {
        "-z": {row, col, rows: 1, cols},
        "+z": {row: row + rows - 1, col, rows: 1, cols},
        "-x": {row, col, rows, cols: 1},
        "+x": {row, col: col + cols - 1, rows, cols: 1},
    };
    for (const [side, box] of Object.entries(walls))
    {
        if (open.includes(side))
            continue;
        await addBlocks(page, {...box, collisionLayer: base, layers, textureIndex: wallTextureIndex});
    }

    return {
        row, col, rows, cols,
        floorY: base * 0.5,
        centre: {x: col + cols / 2, z: row + rows / 2},
        inside: {row: row + 1, col: col + 1, rows: rows - 2, cols: cols - 2},

        // Each wall's cells and inward face. Hanging on the cell in front of a wall silently hangs on
        // nothing, so spread one of these into `addObject` and choose only the position along the wall:
        //
        //   addObject({type: "Door", ...stage.walls["+z"], col: 15, metadata: {Label: "Cellar"}})
        walls: {
            "-z": {row, face: "+z"},
            "+z": {row: row + rows - 1, face: "-z"},
            "-x": {col, face: "+x"},
            "+x": {col: col + cols - 1, face: "-x"},
        },
    };
}

// Sandbox methods live under a group on the bridge; errors are unwrapped as in `call` (e.g. "this is not
// the sandbox room").
async function callSandbox(page, method, ...args)
{
    try
    {
        return await page.evaluate(({name, method, args}) => window[name].sandbox[method](...args),
            {name: BRIDGE, method, args});
    }
    catch (err)
    {
        const message = String(err && err.message ? err.message : err);
        const inner = message.match(/Error: ([^\n]+)/);
        throw new Error(`setup.sandbox.${method} failed: ${inner ? inner[1] : message}`);
    }
}

module.exports = {
    BRIDGE,
    hasSetup, waitForSetup, call,
    pose, standingSpots,
    place, face, faceDeg, vantage,
    look, view, swing, lookAt, clearLookAt,
    sandboxActive, camera, cameraPose, addBlocks, removeBlocks, clearSandbox, roomLighting,
    texturePack, palettes, pictures, doorStyles, canvasFrameStyles, addObject, resizeObject, removeObject,
    restrictedZones, stage,
    sleep,
};
