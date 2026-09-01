// Arranging the scene a run is about to act in: where the player stands, and where the camera looks
// from.
//
// This is the other half of interact.js, and the split between them is the point. That file drives
// the game the way a person does, because what a run is testing has to happen through the same path
// a player's action takes. This one does not test anything — it puts the pieces where the test
// begins. Standing on the gallery above is not what a shot of the gallery is proving; it is what has
// to be true before the shot is taken.
//
// The distinction is worth keeping sharp, because collapsing it is what makes an automated run stop
// meaning anything. Nothing here clicks, selects, or edits, and nothing here should ever learn how:
// the moment a run can place a door by asking for one, a passing run stops being evidence that
// placing a door works.
//
// What it buys is most of the wall-clock time. Reaching a spot by walking costs tens of seconds
// through controls that were built to feel like a person moving rather than to be aimed — the walk
// covers about a pace in a few seconds, the turn's gain varies more than tenfold between runs — and
// it lands somewhere slightly different every time. Every one of those is a run that has to be
// looked at, adjusted and taken again.

const BRIDGE = "__thingspool_setup";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// How long the client is given to take up a placement or a view before it is read back. Both are
// applied on the frame after they are asked for — a placement goes through the object's transform,
// a view is taken up by the camera after it has framed whatever it is pointed at — so a read in the
// same breath as the write answers with the old value.
const SETTLE_MS = 250;

async function hasSetup(page)
{
    return page.evaluate((name) => typeof window[name] === "object" && window[name] !== null, BRIDGE);
}

// Absent for the same two reasons the read-only bridge is: the page has not finished booting, or
// this is a build served by the public site, which installs neither.
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

// Errors thrown inside the page arrive as Playwright's own wrapper around them, which buries the
// sentence the bridge wrote in a stack. Since those sentences are the whole way a caller finds out
// that a cell is solid or that a layer has nothing to stand on, they are dug back out.
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

// Everywhere in the room the player could be put down, nearest first — the answer to "where is there
// to stand", read off the grid the room was built from rather than found by walking it.
//
// A room stands two storeys tall, so the same cell can come back twice at different heights;
// `collisionLayer` is what tells the storeys apart, and passing one narrows the answer to that
// storey.
const standingSpots = (page, options) => call(page, "standingSpots", options || {});

// ─── Putting it where the shot needs it ─────────────────────────────────

/**
 * Stands the player at a point, optionally facing another one. Returns the pose it actually reached,
 * which is what to assert against — a caller that trusts the arguments it passed is not checking
 * anything.
 */
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
 * Puts the player somewhere he can stand near a point, facing it. This is the call a shot usually
 * wants: the thing being photographed is rarely somewhere to stand, and the vantage a frame needs is
 * a short way off it rather than on it.
 *
 * `distance` is how far off to stand, and the nearest standing spot to that ring is taken — so a
 * subject in a corner is still viewed from wherever there is floor, rather than the call failing.
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

    // Nearest to the ring rather than nearest to the subject: standing on top of something is not a
    // view of it.
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
 * The view the orbit camera should take up: `azimuthDeg` around the vertical axis, `polarDeg` away
 * from straight up, and `zoom` from 0 (as far back as the mode allows) to 1 (as close as it allows).
 * Any of them may be left out to keep what the camera already has.
 *
 * The orbit belongs to edit mode. In play mode the camera sits at the player's eye and rides his
 * object, so a view set there is taken up when the mode next is — call `Interact.ensureEditMode`
 * first if the shot needs it now.
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

/**
 * Where the orbit is looking from now, in the units `look` takes. Edit mode frames its subject from
 * wherever the camera already stood, so what a shot wants is usually a swing *off* that rather than
 * an absolute angle it cannot know in advance — which is what this is read for.
 */
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
//
// Everything above arranges a room the game generated. These arrange a room generated to be
// arranged: an empty single-player one, entered with `--sandbox`, whose camera is free of the player
// and whose contents can be stood up by asking.
//
// This is the studio a dev-log post's photographs are taken in, and it is worth having because of
// what a capture otherwise spends itself on. A shot of a feature would have to find its subject
// somewhere in a generated room first — a wall that will take a door, a staircase with a clear line
// up it — and that search is most of a run, is why one comes out looking slightly different each
// time, and leaves the frame composed by wherever the search ended rather than by the picture. In
// here the set is built to suit the frame, and the camera goes exactly where the picture wants it.
//
// A set is scenery, in the sense a film set is: the walls and the furniture are there to stand the
// subject in something. What a photograph is honest about is the thing it is of — a material, a
// shape, a doorway, a piece of geometry — and that thing is the real one, spawned and drawn and lit
// exactly as the game spawns and draws and lights it.

/** Whether this page is in the sandbox, so a script can branch instead of failing on its first build. */
const sandboxActive = (page) => callSandbox(page, "active");

/**
 * Where the free camera stands and what it is aimed at, in world coordinates. Either half may be
 * given alone: moving without re-aiming keeps the subject in frame, which is how a shot is dollied
 * in or lifted over its set.
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
 * Stands a box of blocks up: a corner cell (`row`, `col`, `collisionLayer`) and a size in cells and
 * layers (`rows`, `cols`, `layers`, each defaulting to one), finished in `textureIndex` of the
 * room's pack. A plinth, a backdrop wall and a single block are all this call.
 */
const addBlocks = (page, region) => callSandbox(page, "addBlocks", region);

/** Takes the same kind of box away again. */
const removeBlocks = (page, region) => callSandbox(page, "removeBlocks", region);

/**
 * What the set is finished in — one of the game's texture packs, which re-dresses everything already
 * standing. Called with nothing it reports the current pack and the ones on offer.
 */
const texturePack = (page, path) => callSandbox(page, "texturePack", path);

/**
 * The texture indices the game finishes its own rooms in, as `{floor, ceiling, wall, prop}` sets
 * chosen to go together. Dress a set out of one of these; indices picked freehand come out looking
 * like a paint chart rather than a room.
 */
const palettes = (page, texturePackPath) => callSandbox(page, "palettes", texturePackPath);

/** The paintings a canvas can carry, each with its title and painter. */
const pictures = (page) => callSandbox(page, "pictures");

/**
 * The twelve finishes a door can be given, each ready to pass straight back as metadata:
 *
 *   const styles = await setup.doorStyles();
 *   addObject({type: "Door", ...wall, col: 14, metadata: {Label: "Cellar", ...styles[3]}})
 *
 * A door given none takes one at random, seeded from its own id — fine in a room, but in a
 * photograph the dice regularly hand three doors in a row the same paint.
 */
const doorStyles = (page) => callSandbox(page, "doorStyles");

/**
 * Hangs a picture or a door on the face of a cell:
 *
 *   addObject({type: "Canvas", row, col, face: "-z", collisionLayer: 2, metadata: {ImagePath: "1/14"}})
 *   addObject({type: "Door", row, col, face: "+x", metadata: {Label: "Library"}})
 *
 * `face` is which side of the cell it hangs on (`-x`, `+x`, `-z`, `+z`) and `collisionLayer` how far
 * up the wall — the same terms the wall itself was built in, so moving the wall does not mean
 * recomputing the picture's coordinates. A door ignores the layer and stands on the floor unless
 * given a `y`. Metadata is keyed by the game's own names; returns the object's id.
 */
const addObject = (page, spec) => callSandbox(page, "addObject", spec);

/** Takes one down again, by the id `addObject` gave back. */
const removeObject = (page, objectId) => callSandbox(page, "removeObject", objectId);

/** Empties the set back to bare floor and puts the camera back, between one shot and the next. */
const clearSandbox = (page) => callSandbox(page, "clear");

/**
 * Stands a room up: four walls around a rectangle of floor, with whichever sides left open.
 *
 * This is the shape almost every set starts as, and building it out of `addBlocks` by hand is four
 * calls whose arithmetic is easy to get subtly wrong — a wall a cell short leaves a gap in the
 * corner of the frame, which is exactly the sort of thing that is noticed only after the picture is
 * taken. `open` names the sides to leave out (`["-z"]` for a room the camera looks into), `layers`
 * is how tall the walls are in collision layers, and `floorTextureIndex` lays a floor over the
 * room's own if the set wants one of a different material.
 *
 * Returns the rectangle's inside, which is what a camera aiming into the room needs.
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

    // The floor, if one was laid, is a layer of blocks standing on the room's own — so the walls
    // start above it rather than half-buried in it.
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

        // Each wall's own cells, and which of their faces looks into the room. Handed back because
        // getting it wrong is silent: an object hung on the cell one *in front* of a wall hangs on
        // nothing, and from most angles that reads as a door standing in the middle of the floor
        // rather than as a mistake. Spread one of these into `addObject` and only the row or column
        // along the wall is left to choose:
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

// The sandbox methods hang off a group rather than the bridge's top level, so they are reached by a
// path rather than a name — and the bridge's own error sentence is dug back out the same way `call`
// does it, since "this is not the sandbox room" is the sentence a caller most needs to read.
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
    sandboxActive, camera, cameraPose, addBlocks, removeBlocks, clearSandbox,
    texturePack, palettes, pictures, doorStyles, addObject, removeObject, stage,
    sleep,
};
