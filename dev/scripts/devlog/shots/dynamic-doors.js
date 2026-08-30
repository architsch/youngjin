// Shots for the "Dynamic Doors" post.
//
// Three frames that have to differ in kind rather than in degree (reference/capture.md, faults 5
// and 6), so the vantages are chosen before anything is shot:
//
//   room     play mode, first person, oblique across the spawn hall — how a player meets the doors
//   placing  edit mode in the hall that stands open through both storeys, camera lifted well above
//            a door and looking down on it
//   finish   edit mode, close and oblique at a door's own level, the admin's own tools open
//
// The elevated frame has to be taken in the two-storey hall specifically. Anywhere else in this room
// a storey floor slab hangs between a lifted camera and the ground below it, and the slab is culled
// away while it stands in the way — which leaves a hole across the frame rather than a view down.
//
// A generated hub is one repeated block in every direction, so the wall each frame uses is dressed
// before it is shot: pictures hung along it, a second door beside the first, a band of another
// material at door height, a low plinth standing out from the foot of it. Every one of those is
// something the post is describing anyway.
//
// The room is saved between runs, so every step checks what it finds rather than assuming a bare
// wall — the doors, the dressing and the labels all survive from the run before.

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
async function pickDoor(ctx, xs, y)
{
    for (const x of xs)
    {
        await ctx.clickAt({ x, y });
        await ctx.sleep(1900);
        if (await vis(ctx, "changeDoorLabelButton"))
            return true;
        await deselect(ctx);
    }
    return false;
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
        await Nav.installPose(ctx);
        log("spawn: " + Nav.describe(await Nav.pose(ctx)));

        // === The spawn hall's south wall ===================================================
        // Standing back off the wall the arrival door hangs on, square to it, is the one vantage
        // this room pins down: the passage mouth behind the player stops him drifting, so the wall
        // fills the frame the same way every run and the dressing below can be aimed by coordinate.
        await Nav.goTo(ctx, 16.5, 27.2, { timeoutMs: 60000, arrive: 0.9, log: quiet });
        await Nav.facePoint(ctx, 16.2, 31.0, { log: quiet });
        await sleep(1800);
        log("wall vantage: " + Nav.describe(await Nav.pose(ctx)));
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
        if (await pickDoor(ctx, [585, 640, 530, 690, 480], 430))
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

        // === FRAME: room — play mode, oblique across the hall ================================
        // East of the doors and looking back west along the wall, so the wall recedes instead of
        // standing square across the frame, and the hall's far corner carries the other side.
        // Walked at twice, and arrived at tightly. Which way the wall runs across this frame turns
        // on where the player is standing rather than on where he is looking — a pace of drift here
        // swings the wall by twenty degrees — so it is worth the second approach.
        await Nav.goTo(ctx, 19.6, 27.5, { timeoutMs: 55000, arrive: 1.2, log: quiet });
        await Nav.goTo(ctx, 19.6, 27.5, { timeoutMs: 35000, arrive: 0.5, log: quiet });
        await Nav.facePoint(ctx, 15.7, 31.0, { log: quiet });
        await sleep(2200);
        log("room vantage: " + Nav.describe(await Nav.pose(ctx)));
        await shot("room");

        // === FRAME: placing — lifted well above a door in the two-storey hall =================
        // North through the passage into the hall that stands open through both storeys. It is the
        // only space here where a camera can be raised over a door without the storey floor being
        // culled out of the frame between the two.
        await Nav.goTo(ctx, 16.0, 24.5, { timeoutMs: 55000, arrive: 1.0, log: quiet });
        await Nav.goTo(ctx, 15.0, 19.5, { timeoutMs: 60000, arrive: 1.2, log: quiet });
        await sleep(1200);
        log("tall hall: " + Nav.describe(await Nav.pose(ctx)));
        await Nav.facePoint(ctx, 11.0, 19.5, { log: quiet });
        await sleep(2000);
        await diag("tallhall");

        if (await addDoor(ctx, [{ x: 640, y: 470 }, { x: 560, y: 470 }, { x: 720, y: 470 },
            { x: 480, y: 470 }, { x: 800, y: 470 }], log))
        {
            await nameDoor(ctx, "The Undercroft");
            // Raised about a third of the way towards straight down, and brought round so the wall
            // runs away to the right into the opening beyond it. The swing is made in two parts
            // rather than one of +140: the orbit is wound the wrong way first, which is what puts
            // the room's stair and its warm floor on the far side of the door instead of a bare
            // corner, and the lift is taken between them.
            await settleZoom(ctx, 5);
            await swing(ctx, -140, 0);
            await lift(ctx, 110);
            await swing(ctx, 280, 0);
            await shot("placing");
        }
        else log("placing: no door could be hung in the tall hall");
        await deselect(ctx);
    },
};
