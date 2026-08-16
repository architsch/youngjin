// Shots for the "game mode" post: what edit mode opens on, what a picture looks like while it is
// being edited, and what a click on that same picture amounts to in play mode.
//
// All three are taken from one place — the wall the player is walked into until he stops. That stop
// is what lets the click points below be written down as numbers at all: where a timed walk across
// open floor ends varies between runs, and where a wall stops him does not. The walk is long
// because the player covers ground slowly. Three seconds of it leaves him most of a room short of
// any wall, and every shot then has its subject far away — which is the fault the composition rules
// in the skill's reference/capture.md exist to prevent.
//
// The other two rules are in the numbers: each shot comes round off the square-on view rather than
// standing perpendicular to the wall, and each is framed from the side where the room, its doorway
// and its other pictures fill the corners instead of a blank stretch of wall.

const CHARACTER_ZOOM_IN = 3;      // notches closer; the whole figure, above the tool strip
const CHARACTER_SWING_PX = 360;   // 135 degrees round: a three-quarter view of the face
const CANVAS_ZOOM_IN = 5;         // the near end of the orbit's range, where a picture reads properly
const CANVAS_SWING_PX = -140;     // ~52 degrees off square, toward the room rather than the wall
const PLAY_TURNS = 3;             // how far the player turns off the wall for the play-mode frame
const PLAY_TURN_PX = 70;

// About 960 px of horizontal drag carries the orbit a full turn.
async function swing(ctx, px)
{
    const dir = px >= 0 ? 1 : -1;
    let left = Math.abs(px);
    while (left > 0)
    {
        // Broken into strokes that fit the viewport, since one drag cannot leave it.
        const step = Math.min(left, 400);
        await ctx.drag({ x: 640 - dir * step / 2, y: 400 }, { x: 640 + dir * step / 2, y: 400 },
            { steps: 30 });
        left -= step;
        await ctx.sleep(400);
    }
    await ctx.sleep(700);
}

// Negative deltaY brings the view closer, positive pushes it away.
async function wheel(ctx, notches)
{
    await ctx.page.mouse.move(640, 400);
    for (let i = 0; i < Math.abs(notches); ++i)
    {
        await ctx.page.mouse.wheel(0, notches > 0 ? -100 : 100);
        await ctx.sleep(400);
    }
    await ctx.sleep(700);
}

// Steering is a joystick: what turns the player is how long the pointer is held away from the press
// point, not how far it travelled, so a turn is a press, a move, and a wait.
async function steer(ctx, dx, ms)
{
    await ctx.page.mouse.move(640, 400);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(640 + dx, 400, { steps: 8 });
    await ctx.page.waitForTimeout(ms);
    await ctx.page.mouse.up();
    await ctx.sleep(600);
}

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "game-mode",
    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickAt, clickId, page, log } = ctx;

        // Into the wall, and up against it. Held in three goes rather than one, so a stall in any of
        // them still leaves the rest of the walk to recover it.
        for (let i = 0; i < 3; ++i)
            await ctx.hold("ArrowUp", 6000);
        await sleep(1200);

        // --- Edit mode as it opens: on the user's own character. ---
        await clickId("editModeButton");
        await sleep(2800);
        await wheel(ctx, CHARACTER_ZOOM_IN);
        await swing(ctx, CHARACTER_SWING_PX);
        await shot("character");

        // Leaving the mode hands the camera back to the player's eye and drops the zoom with it,
        // which is the state the click points below are written for.
        await clickId("modeExitButton");
        await sleep(2200);

        // --- Edit mode on a picture: the orbit and the tools both go to it. ---
        await clickId("editModeButton");
        await sleep(2800);

        // Near the end of the wall, beside the doorway, so that swinging the orbit round brings the
        // room beyond into the frame instead of more of the same wall.
        let canvas = false;
        for (const p of [{x: 760, y: 300}, {x: 740, y: 350}, {x: 780, y: 260}, {x: 700, y: 320}])
        {
            await clickAt(p);
            await sleep(1400);
            if (await visible(ctx, "changeCanvasImageButton"))
            {
                canvas = true;
                log("picture selected in edit mode at " + JSON.stringify(p));
                break;
            }
            // A miss lands on the wall itself, which offers the tool for hanging a picture there.
            // That is as good a subject as one already hanging — and is what lets this run work on a
            // stretch of wall that room generation left bare.
            if (await visible(ctx, "addCanvasButton"))
            {
                await clickId("addCanvasButton");
                await sleep(2800);
                if (await visible(ctx, "changeCanvasImageButton"))
                {
                    canvas = true;
                    log("picture hung on the wall at " + JSON.stringify(p));
                    break;
                }
            }
        }
        if (!canvas)
            throw new Error("Could not get a picture selected in edit mode.");

        await wheel(ctx, CANVAS_ZOOM_IN);
        await swing(ctx, CANVAS_SWING_PX);
        await shot("editing");

        // --- Play mode: a click on that same picture says what it is, and nothing more. ---
        // The orbit never moved the player, so leaving the mode puts the camera back at his eye,
        // facing the wall square on. Turning off it carries the pictures onto the left of the frame
        // and opens the room, its pillars and its far doorway into the rest of it, in place of the
        // blank stretch of wall that otherwise takes up half the shot.
        await clickId("modeExitButton");
        await sleep(2400);
        for (let i = 0; i < PLAY_TURNS; ++i)
            await steer(ctx, PLAY_TURN_PX, 250);

        let picked = false;
        for (const p of [{x: 415, y: 395}, {x: 400, y: 420}, {x: 430, y: 370}, {x: 415, y: 570}])
        {
            await clickAt(p);
            await sleep(1100);
            if (await page.getByText("Title:").first().isVisible().catch(() => false))
            {
                picked = true;
                log("picture selected in play mode at " + JSON.stringify(p));
                break;
            }
        }
        if (!picked)
            throw new Error("Could not select the picture on the wall in play mode.");
        await shot("play");
    },
};
