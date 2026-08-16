// The image for the dev log's opening entry. That post is about the project rather than about one
// feature, so what it wants is a single frame that says what ThingsPool is: a room made of voxel
// blocks, pictures hanging on its walls, and the editing controls that put them there.
//
// It is therefore framed wider than a feature post's shots — a couple of notches in from the
// orbit's framing distance rather than the whole way — while still following the same composition
// rules (see the skill's reference/capture.md): come round off the wall's square-on view so the
// room recedes, and lift the camera enough to see over the wall into what lies beyond it without
// going so high that the black above a ceilingless room comes into frame.
//
// The camera only ever leaves the player by selecting something in edit mode, so the shot is set up
// by picking out a picture on the wall the player has walked into.

const ROOM_ZOOM_IN = 2;     // notches closer; wide enough to keep the room, close enough to read it
const ROOM_SWING_PX = -140; // ~52 degrees off the wall's square-on view
const ROOM_PITCH_PX = 40;   // and lifted over it, to see into the room beyond

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

async function swing(ctx, px)
{
    const dir = px >= 0 ? 1 : -1;
    let left = Math.abs(px);
    while (left > 0)
    {
        const step = Math.min(left, 400);
        await ctx.drag({ x: 640 - dir * step / 2, y: 400 }, { x: 640 + dir * step / 2, y: 400 },
            { steps: 30 });
        left -= step;
        await ctx.sleep(400);
    }
    await ctx.sleep(700);
}

// Dragging the pointer down lifts the camera above what it is looking at.
async function pitch(ctx, px)
{
    await ctx.drag({ x: 640, y: 400 - px / 2 }, { x: 640, y: 400 + px / 2 }, { steps: 25 });
    await ctx.sleep(900);
}

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "devlog-intro",
    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickAt, clickId, log } = ctx;

        // Into the wall, and up against it — a position that does not vary between runs, unlike
        // where a timed walk across open floor ends. The walk is long because the player covers
        // ground slowly.
        for (let i = 0; i < 3; ++i)
            await ctx.hold("ArrowUp", 6000);
        await sleep(1200);

        await clickId("editModeButton");
        await sleep(2800);

        let canvas = false;
        for (const p of [{x: 760, y: 300}, {x: 740, y: 350}, {x: 780, y: 260}, {x: 700, y: 320}])
        {
            await clickAt(p);
            await sleep(1400);
            if (await visible(ctx, "changeCanvasImageButton"))
            {
                canvas = true;
                log("picture selected at " + JSON.stringify(p));
                break;
            }
            // A miss lands on the wall, which offers the tool for hanging a picture there — which is
            // what lets this run work on a stretch of wall generation left bare.
            if (await visible(ctx, "addCanvasButton"))
            {
                await clickId("addCanvasButton");
                await sleep(2800);
                if (await visible(ctx, "changeCanvasImageButton"))
                {
                    canvas = true;
                    log("picture hung at " + JSON.stringify(p));
                    break;
                }
            }
        }
        if (!canvas)
            throw new Error("Nothing on the wall could be selected — the camera never left the player.");

        await wheel(ctx, ROOM_ZOOM_IN);
        await swing(ctx, ROOM_SWING_PX);
        await pitch(ctx, ROOM_PITCH_PX);
        await shot("editing");
    },
};
