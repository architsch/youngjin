/**
 * The "Dynamic Doors" shot that can't be taken in the sandbox: `dynamic-doors-finish`, the admin's door
 * customization panel, performed as real gestures in a generated room on the seeded admin seat (the other
 * two images come from `dynamic-doors.js`). Writes only `dynamic-doors-finish.jpg`, the name the post
 * references, so the two scripts never overwrite each other.
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/dynamic-doors-admin.js
 *
 * A generated hub repeats one block everywhere, so most of this dresses the framed wall first: pictures,
 * a second door, and a band of another material.
 */
const Nav = require("./nav.js");

// Texture indices in this room's pack ("inferno", an 8x8 atlas; the walls are sandstone at 17). Palette
// DOM children follow the same order, so swatches are reached by index (the strip scrolls itself).
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

// Pins the camera a known number of notches from the near end by first zooming fully in (edit mode opens
// at the previous camera distance).
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

// Clicks the world and reports "door", "quad" (a wall or floor face) or "none". On the admin seat a door
// click enters edit mode with the selection; a face offers "Start Editing" first.
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

// Paints the selected face; swatches are reached through the DOM in texture order.
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

// Grows a block off the selected face and repaints it, for a low foreground plinth.
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

// Takes hold of the nearest reachable door the page reports (screen positions vary with room and camera).
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

// Typed, not filled, since the form writes each keystroke through to the door.
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

// Steps the preset stepper until it shows the target (it opens on the door's current, persisted scheme).
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

    // The seeded admin: only admins manage doors, so none of this appears for a member.
    devUser: 4,

    // A generated room: the admin's door tools need a room to edit.
    freshRoom: true,

    // Only a hub raises both storeys, and doors answer to an admin in a hub and nowhere else.
    roomType: "hub",

    startPath: "/",
    tutorial: false,

    async run(ctx)
    {
        const { shot, sleep, log } = ctx;
        const quiet = () => {};
        // Diagnostic frames, off by default; set DEVLOG_DIAG=1 to write them.
        const diag = process.env.DEVLOG_DIAG ? shot : async () => {};
        log("spawn: " + Nav.describe(await ctx.setup.pose()));

        // === The spawn hall's south wall ===================================================
        // Placed (not walked) back from the arrival door's wall, square to it: the vantage the dressing is aimed from.
        await ctx.setup.place(16.5, 27.2, { faceX: 16.2, faceZ: 31.0 });
        await sleep(1800);
        log("wall vantage: " + Nav.describe(await ctx.setup.pose()));
        await diag("wall");

        log("dressing the south wall");
        await hangPictures(ctx, [{ x: 235, y: 400 }, { x: 1130, y: 380 }], log);
        await paintFaces(ctx, [
            { x: 330, y: 560 }, { x: 415, y: 560 }, { x: 810, y: 560 }, { x: 900, y: 560 },
        ], TEX.cobble, log);
        // The unlit niche would photograph as a black rectangle, so its inner faces get the glowing material.
        await paintFaces(ctx, [{ x: 1000, y: 480 }, { x: 1035, y: 545 }], TEX.lava, log);
        // One block per run, since the room keeps earlier runs' builds.
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
