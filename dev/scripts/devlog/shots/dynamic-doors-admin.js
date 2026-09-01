/**
 * The one "Dynamic Doors" screenshot that cannot be taken in the sandbox: `dynamic-doors-finish`,
 * the panel an admin customizes a door's timber, plate and knob through.
 *
 * It is a picture of the game being used rather than of a room, so every part of it — entering edit
 * mode, taking hold of a door, opening the panel — has to happen as a real gesture, in a room the
 * generator made, on the seeded admin seat. The post's other two images are set pieces built in the
 * sandbox by `dynamic-doors.js`, in about a tenth of the time this takes.
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/dynamic-doors-admin.js
 *
 * The slug stays "dynamic-doors" because it names the file this writes, which the post refers to by
 * name. This writes only `dynamic-doors-finish.jpg`, so the two scripts never overwrite each other.
 *
 * A generated hub is one repeated block in every direction, so the wall the frame uses is dressed
 * before it is shot: pictures hung along it, a second door beside the first, a band of another
 * material at the subject's own height. That dressing is most of what follows.
 */
const Nav = require("./nav.js");

// Texture indices into this room's pack ("inferno", an 8x8 atlas whose walls here are finished in
// the pale sandstone at 17). The palette's DOM children run in this same order, so a swatch is
// reached by index rather than by a pixel coordinate in a strip that scrolls itself to whatever is
// currently selected.
const TEX = {
    cobble: 36,     // cool grey brick, against the warm sandstone
    lava: 45,       // glowing cracks: the one saturated note
    checker: 9,     // black and white diamond tile
    parquet: 56,    // dark brown parquet
};

const vis = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

const off = async (ctx, id) =>
    /yj-panel-disabled/.test((await ctx.page.locator(`#${id}`).first()
        .getAttribute("class").catch(() => "")) || "");

// --- Camera ---------------------------------------------------------------------------------

// Swings the orbit sideways. Dragging down (positive dy) lifts the camera above the subject.
async function swing(ctx, px, dy)
{
    const dir = px >= 0 ? 1 : -1;
    let left = Math.abs(px);
    const totalSteps = Math.max(1, Math.ceil(left / 400));
    const dyStep = (dy || 0) / totalSteps;
    while (left > 0)
    {
        const step = Math.min(left, 400);
        await ctx.drag({ x: 640 - dir * step / 2, y: 400 - dyStep / 2 },
            { x: 640 + dir * step / 2, y: 400 + dyStep / 2 }, { steps: 30 });
        left -= step;
        await ctx.sleep(400);
    }
    await ctx.sleep(700);
}

// Raises the camera without turning it, in bites the orbit will follow.
async function lift(ctx, dy)
{
    const dir = dy >= 0 ? 1 : -1;
    let left = Math.abs(dy);
    while (left > 0)
    {
        const step = Math.min(left, 180);
        await ctx.drag({ x: 640, y: 400 - dir * step / 2 },
            { x: 640, y: 400 + dir * step / 2 }, { steps: 24 });
        left -= step;
        await ctx.sleep(400);
    }
    await ctx.sleep(700);
}

// Positive brings the view closer, negative pushes it away.
async function wheel(ctx, notches)
{
    await ctx.page.mouse.move(640, 400);
    for (let i = 0; i < Math.abs(notches); ++i)
    {
        await ctx.page.mouse.wheel(0, notches > 0 ? -100 : 100);
        await ctx.sleep(260);
    }
    await ctx.sleep(700);
}

// Puts the camera a known number of notches from the near end of its range by running it up against
// that end first. Edit mode opens at whatever distance the camera already stood from what it is now
// framing, so counting notches from wherever the mode opened frames a different shot every run.
async function settleZoom(ctx, notchesBack)
{
    await wheel(ctx, 14);
    await wheel(ctx, -notchesBack);
}

// --- Selection ------------------------------------------------------------------------------

async function deselect(ctx)
{
    for (let i = 0; i < 3; ++i)
    {
        if (!(await vis(ctx, "modeExitButton")))
            return;
        await ctx.clickId("modeExitButton");
        await ctx.sleep(1500);
    }
}

// Clicks the world and reports what came up: "door", "quad" (a wall or floor face), or "none". On
// the admin seat a door takes hold of itself and opens edit mode along with the selection; a wall
// face only offers "Start Editing", which has to be taken up before its tools appear.
async function selectAt(ctx, x, y)
{
    await ctx.clickAt({ x, y });
    await ctx.sleep(1700);
    if (await vis(ctx, "changeDoorLabelButton"))
        return "door";
    if (await vis(ctx, "startEditingButton"))
    {
        await ctx.clickId("startEditingButton");
        await ctx.sleep(2100);
    }
    return (await vis(ctx, "voxelQuadTextureOptions")) ? "quad" : "none";
}

// Paints the selected face. The palette carries itself to whatever is already selected, so its
// swatches are reached through the DOM in texture order rather than by a coordinate that moves.
async function paint(ctx, textureIndex)
{
    const swatch = ctx.page.locator("#voxelQuadTextureOptions > *").nth(textureIndex);
    await swatch.scrollIntoViewIfNeeded().catch(() => {});
    await swatch.click({ timeout: 8000 }).catch(() => {});
    await ctx.sleep(800);
}

// --- Dressing -------------------------------------------------------------------------------

async function paintFaces(ctx, points, textureIndex, log)
{
    let n = 0;
    for (const p of points)
    {
        if (await selectAt(ctx, p.x, p.y) == "quad") { await paint(ctx, textureIndex); ++n; }
        await deselect(ctx);
    }
    log(`  painted ${n}/${points.length}`);
}

// Hangs pictures, which are what carry a corner of the frame that would otherwise be blank wall.
async function hangPictures(ctx, points, log)
{
    let n = 0;
    for (const p of points)
    {
        if (await selectAt(ctx, p.x, p.y) == "quad" && await vis(ctx, "addCanvasButton")
            && !(await off(ctx, "addCanvasButton")))
        {
            await ctx.clickId("addCanvasButton");
            await ctx.sleep(2600);
            ++n;
        }
        await deselect(ctx);
    }
    log(`  hung ${n}/${points.length} pictures`);
}

// Grows a block off the selected face and repaints it, so it does not read as more of the wall it
// came from. Used for the low plinth that gives the foreground something at its own depth.
async function buildPlinth(ctx, x, y, depth, textureIndex, log)
{
    if (await selectAt(ctx, x, y) != "quad")
    {
        await deselect(ctx);
        log(`  plinth ${x},${y}: no face`);
        return;
    }
    let n = 0;
    for (let i = 0; i < depth; ++i)
    {
        if (!(await vis(ctx, "addVoxelBlockButton")) || await off(ctx, "addVoxelBlockButton"))
            break;
        await ctx.clickId("addVoxelBlockButton");
        await ctx.sleep(1700);
        ++n;
    }
    if (n > 0 && await vis(ctx, "voxelQuadTextureOptions"))
        await paint(ctx, textureIndex);
    await deselect(ctx);
    log(`  plinth ${x},${y}: ${n} block(s)`);
}

// --- Doors ----------------------------------------------------------------------------------

// Sweeps outward from a point until a door's own tools come up. A door is a narrow thing at the end
// of a turn that stops a few degrees either side of where it was aimed, so a single coordinate
// written down from one run lands on the wall beside it in the next.
// Takes hold of a door — the nearest one the page reports as reachable, rather than a sweep of
// screen coordinates. Where a door falls on screen depends on the room that was generated and on
// where the camera ended up, so a list of pixels is a list of guesses that were right once.
async function pickDoor(ctx)
{
    try
    {
        await ctx.interact.clickObject({ objectType: "Door" }, { approach: false });
    }
    catch (err)
    {
        ctx.log(`  no door could be taken hold of: ${err.message}`);
        return false;
    }
    await ctx.sleep(1900);
    return await vis(ctx, "changeDoorLabelButton");
}

// Hangs a door on the first of the given points that will take one.
async function addDoor(ctx, points, log)
{
    for (const p of points)
    {
        const what = await selectAt(ctx, p.x, p.y);
        if (what == "door")
            { log(`  door already at ${p.x},${p.y}`); return true; }
        if (what == "quad" && await vis(ctx, "addDoorButton") && !(await off(ctx, "addDoorButton")))
        {
            await ctx.clickId("addDoorButton");
            await ctx.sleep(3500);
            if (await vis(ctx, "changeDoorLabelButton"))
                { log(`  hung a door at ${p.x},${p.y}`); return true; }
        }
        await deselect(ctx);
    }
    log("  no door could be hung");
    return false;
}

// Writes a name onto the selected door's plate. Typed rather than filled, since the form writes
// every keystroke through to the door as it arrives.
async function nameDoor(ctx, text)
{
    if (!(await vis(ctx, "changeDoorLabelButton")))
        return false;
    await ctx.clickId("changeDoorLabelButton");
    await ctx.sleep(1300);
    const field = ctx.page.locator("#uiRoot input").last();
    await field.click();
    await field.fill("");
    await field.pressSequentially(text, { delay: 55 });
    await ctx.sleep(1000);
    await ctx.clickAt({ x: 805, y: 347 });      // the popup's close button
    await ctx.sleep(1500);
    return true;
}

// Puts the appearance bar's preset stepper on one particular scheme by reading what it shows and
// stepping until it shows what is wanted. The bar opens on whatever the door is already wearing and
// the room is saved between runs, so a fixed number of steps paints a different door each time.
async function setPreset(ctx, target)
{
    const readout = ctx.page.locator("#customizeDoorOptions div")
        .filter({ hasText: /^\d+\/\d+$/ }).last();
    for (let i = 0; i < 16; ++i)
    {
        const shown = ((await readout.textContent().catch(() => "")) || "").trim();
        if (parseInt(shown.split("/")[0], 10) === target)
            return true;
        await ctx.clickAt({ x: 137, y: 693 });   // the stepper's forward arrow
        await ctx.sleep(800);
    }
    return false;
}

module.exports = {
    slug: "dynamic-doors",

    // The seeded admin. Doors are his to lay; for everybody else a door is only somewhere to walk
    // through, so nothing below would be on screen at all as an ordinary member.
    devUser: 4,

    // A generated room rather than the sandbox: the panel this frame is of belongs to the admin's
    // tools, and the tools only exist where there is a room to edit and a door that is his to hold.
    freshRoom: true,

    // Only a hub raises both storeys, and doors answer to an admin in a hub and nowhere else.
    roomType: "hub",

    startPath: "/",
    tutorial: false,

    async run(ctx)
    {
        const { shot, sleep, log } = ctx;
        const quiet = () => {};
        // Frames kept only while the route and the dressing are being worked out. They are off by
        // default so that a plain run writes the three the post carries and nothing else; set
        // DEVLOG_DIAG=1 to get them back when a step needs to be seen again.
        const diag = process.env.DEVLOG_DIAG ? shot : async () => {};
        log("spawn: " + Nav.describe(await ctx.setup.pose()));

        // === The spawn hall's south wall ===================================================
        // Standing back off the wall the arrival door hangs on, square to it, is the vantage the
        // dressing below is aimed from — so it is set outright rather than walked to. Where the
        // player stands is a precondition of this shot, not the thing it is of, and a held walk key
        // used to spend a minute of the run landing somewhere slightly different each time.
        await ctx.setup.place(16.5, 27.2, { faceX: 16.2, faceZ: 31.0 });
        await sleep(1800);
        log("wall vantage: " + Nav.describe(await ctx.setup.pose()));
        await diag("wall");

        log("dressing the south wall");
        await hangPictures(ctx, [{ x: 235, y: 400 }, { x: 1130, y: 380 }], log);
        await paintFaces(ctx, [
            { x: 330, y: 560 }, { x: 415, y: 560 }, { x: 810, y: 560 }, { x: 900, y: 560 },
        ], TEX.cobble, log);
        // The niche further along this wall is unlit, and an unlit recess photographs as a flat
        // black rectangle. Its inner faces are given the pack's glowing material instead, which
        // reads as an alcove and is the one warm note against the wall's cool grey banding.
        await paintFaces(ctx, [{ x: 1000, y: 480 }, { x: 1035, y: 545 }], TEX.lava, log);
        // One block per run, since the room keeps what the last run built and a plinth grown by two
        // every time would be a wall across the frame within a few passes.
        await buildPlinth(ctx, 300, 690, 1, TEX.lava, log);
        await diag("dressed");

        // A second door, further along the same wall, so no frame has to make do with one.
        if (await addDoor(ctx, [{ x: 880, y: 430 }, { x: 960, y: 430 }, { x: 800, y: 430 }], log))
            await nameDoor(ctx, "Observatory");
        await deselect(ctx);
        await diag("doors");

        // === FRAME: finish — close and oblique, at the door's own level ======================
        if (await pickDoor(ctx))
        {
            await nameDoor(ctx, "Great Hall");
            await settleZoom(ctx, 3);
            await swing(ctx, -150, 30);
            if (await vis(ctx, "customizeDoorButton"))
            {
                await ctx.clickId("customizeDoorButton");
                await sleep(1800);
                await setPreset(ctx, 3);
                await sleep(1000);
            }
            await shot("finish");
            if (await vis(ctx, "customizeDoorButton"))
                { await ctx.clickId("customizeDoorButton"); await sleep(1200); }
        }
        else log("finish: no door came up");
        await deselect(ctx);
    },
};
