// Closed-loop navigation for the capture runner.
//
// Nothing here can be timed. The game advances by wall-clock time, the headless renderer's frame
// rate varies by more than tenfold between runs — and within one — and the client clamps its own
// frame time, so the same held key covers a wildly different distance each time it is held. One
// run turned seventy degrees on a burst that another run needed four seconds for.
//
// What is reproducible is the player's own position, which his client puts on the wire whenever it
// changes. Hooking the socket he sends it on turns "walk for two seconds" into "walk until you are
// there", and lets the steering measure its own gain as it goes rather than assume one.

// How long a held turn takes per degree, learned from the turns already made. The starting guess
// only has to survive the first burst, which then replaces it.
let msPerDegree = 5;

// Which sign of horizontal drag increases the player's heading. Corrected by the first turn that
// goes the wrong way, so neither guess here costs more than one burst.
let turnSign = -1;

async function installPose(ctx)
{
    await ctx.page.evaluate(() =>
    {
        const socket = window.__socket_io_instance;
        if (!socket || socket.__poseHooked)
            return;
        socket.__poseHooked = true;
        const original = socket.emit.bind(socket);
        socket.emit = function (type, payload)
        {
            try
            {
                if (type === "setObjectTransformSignal" && payload instanceof ArrayBuffer)
                {
                    const v = new Uint8Array(payload);
                    let i = 0;
                    const roomStart = i;
                    while (i < v.length && v[i] !== 0) ++i;
                    const roomEnd = i++;
                    while (i < v.length && v[i] !== 0) ++i;
                    ++i;
                    const read = (o, min, max) =>
                        min + (((v[i + o] << 8) | v[i + o + 1]) * (max - min) / 65535.9999);
                    window.__pose = {
                        room: new TextDecoder().decode(v.subarray(roomStart, roomEnd)),
                        x: read(0, 0, 32), y: read(2, 0, 8), z: read(4, 0, 32),
                        // The object's own forward; the way the player walks is its negation.
                        fx: -read(6, -1, 1), fz: -read(10, -1, 1),
                        t: Date.now(),
                    };
                }
            }
            catch (err) { /* never let the hook break the game */ }
            return original(type, payload);
        };
    });
}

async function pose(ctx)
{
    for (let attempt = 0; attempt < 3; ++attempt)
    {
        const p = await ctx.page.evaluate(() => window.__pose || null);
        if (p != null)
            return p;
        // Either nothing has been reported yet — a player who has not moved has had nothing to
        // report — or the page reloaded under us and took the hook with it.
        await installPose(ctx);
        await ctx.hold("ArrowUp", 400);
        await ctx.sleep(800);
    }
    throw new Error("The player's position never came back; the page may have reloaded.");
}

const degrees = (rad) => rad * 180 / Math.PI;
const heading = (p) => Math.atan2(p.fx, p.fz);
const bearingTo = (p, x, z) => Math.atan2(x - p.x, z - p.z);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function angleDiff(a, b)
{
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

// Presses the pointer away from centre and holds it there: what steers is where the pointer is
// being held, not how far it travelled. The release has to happen away from the press point, since
// a gesture ending where it began is a tap on whatever lies under it — which selects a block, or on
// the wrong stretch of wall walks through a door into another room.
async function steerBurst(ctx, px, ms)
{
    const from = 640 - Math.sign(px) * 160;
    await ctx.page.mouse.move(from, 400);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(from + px, 400, { steps: 3 });
    await ctx.page.waitForTimeout(ms);
    await ctx.page.mouse.up();
    await ctx.sleep(200);
}

// One correcting turn, sized from how long a degree has been taking lately, and then used to
// re-measure that. Deliberately undershoots, so the heading is approached rather than swung past.
//
// Which way a given drag turns the player is measured too rather than assumed: it depends on how
// the world's axes and the drag's sign line up, and getting it backwards produces a controller that
// chases the heading further away every burst.
async function turnToward(ctx, errDeg, before, poseAfter)
{
    const ms = Math.round(clamp(Math.abs(errDeg) * msPerDegree * 0.7, 40, 4000));
    await steerBurst(ctx, (errDeg > 0 ? turnSign : -turnSign) * 340, ms);

    const after = await poseAfter();
    const delta = degrees(angleDiff(heading(after), heading(before)));
    if (Math.abs(delta) > 4)
    {
        msPerDegree = clamp(ms / Math.abs(delta), 0.4, 60);
        if (Math.sign(delta) !== Math.sign(errDeg))
            turnSign = -turnSign;
    }
    return after;
}

// Turns on the spot until the player faces the given bearing.
//
// The shortest burst the game answers at all still carries the view some way round, and how far
// depends on the frame rate, so a fixed tolerance can be finer than any single burst can land
// within — and the controller then sits astride the target flipping from one side to the other
// forever. Every flip therefore widens what counts as facing the right way, which makes the loop
// terminate at whatever precision this run's frame rate can actually deliver.
async function faceBearing(ctx, bearingRad, opts = {})
{
    let tolerance = opts.toleranceDeg || 8;
    const deadline = Date.now() + (opts.timeoutMs || 45000);
    const log = opts.log || (() => {});
    let p = await pose(ctx);
    let lastSign = 0;

    while (Date.now() < deadline)
    {
        const err = degrees(angleDiff(bearingRad, heading(p)));
        if (Math.abs(err) <= tolerance)
            return p;
        if (lastSign !== 0 && Math.sign(err) !== lastSign)
            tolerance = Math.min(tolerance + 6, 30);
        lastSign = Math.sign(err);

        log(`  turn: off by ${err.toFixed(0)} deg (gain ${msPerDegree.toFixed(1)} ms/deg, ` +
            `settling for ${tolerance})`);
        p = await turnToward(ctx, err, p, () => pose(ctx));
    }
    log("  turn: gave up");
    return p;
}

const facePoint = (ctx, x, z, opts) =>
    pose(ctx).then(p => faceBearing(ctx, bearingTo(p, x, z), opts || {}));

// Walks to a point with the walk key held down the whole way, correcting the heading with the
// pointer as it goes — the two controls are independent, so steering does not interrupt walking.
// Gives up when the player stops making ground, which is what walking into a wall looks like here.
async function goTo(ctx, x, z, opts = {})
{
    const arrive = opts.arrive || 1.6;
    const deadline = Date.now() + (opts.timeoutMs || 60000);
    const log = opts.log || (() => {});
    const pollMs = opts.pollMs || 450;
    let stalls = 0;
    let detourUntil = 0;

    await facePoint(ctx, x, z, { log });
    await ctx.page.keyboard.down("ArrowUp");
    try
    {
        let last = await pose(ctx);
        while (Date.now() < deadline)
        {
            await ctx.sleep(pollMs);
            const p = await pose(ctx);
            const dist = Math.hypot(p.x - x, p.z - z);
            if (dist <= arrive)
                return p;

            const moved = Math.hypot(p.x - last.x, p.z - last.z);
            last = p;

            if (Date.now() < detourUntil)
                continue;

            if (moved < (opts.minProgress || 0.12) && !opts.noDetour)
            {
                // Blocked. Strike off to one side and hold that heading for a while — a wall is got
                // past by walking along it, and re-aiming at the target every half second only
                // walks back into it. The side alternates so a dead end is backed out of rather
                // than pressed further.
                if (++stalls > (opts.maxStalls || 5))
                {
                    log(`  stuck at ${p.x.toFixed(1)},${p.z.toFixed(1)} short of ${x},${z}`);
                    return p;
                }
                log(`  blocked at ${p.x.toFixed(1)},${p.z.toFixed(1)}; going round`);
                await steerBurst(ctx, (stalls % 2 ? 1 : -1) * 340,
                    Math.round(clamp(60 * msPerDegree * 0.7, 90, 4000)));
                detourUntil = Date.now() + 2500;
                continue;
            }
            stalls = 0;

            const err = degrees(angleDiff(bearingTo(p, x, z), heading(p)));
            if (Math.abs(err) > 20)
                await turnToward(ctx, err, p, () => pose(ctx));
        }
        log(`  timed out short of ${x},${z}`);
        return await pose(ctx);
    }
    finally
    {
        await ctx.page.keyboard.up("ArrowUp");
        await ctx.sleep(300);
    }
}

const describe = (p) => p == null ? "(no pose)" :
    `x=${p.x.toFixed(1)} y=${p.y.toFixed(2)} z=${p.z.toFixed(1)} heading=${degrees(heading(p)).toFixed(0)}deg`;

module.exports = { installPose, pose, faceBearing, facePoint, goTo, steerBurst,
    heading, bearingTo, angleDiff, degrees, describe };
