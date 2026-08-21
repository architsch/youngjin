// Shots for the "second floor" post: a room that stands two storeys tall, the staircase that joins
// them, and what the upper floor looks down on.
//
// The route is written as world coordinates rather than as timings. Nothing here can be timed: the
// game advances by wall-clock time while the headless renderer's frame rate varies by more than
// tenfold between runs, so the same held key covers a different distance every time. Instead the
// player's own position is read back off the socket he reports it on, and every leg runs until he
// is there (see nav.js).
//
// Every leg ends inside a doorway or in open floor, because a walk aimed straight through a wall
// only finds the gap in it by accident. The coordinates come from the room's own saved voxel grid:
// a cell's centre is (col + 0.5, row + 0.5), the ground floor stands at y = 0 and the upper one at
// y = 4.5, so a player standing on the upper floor reports his height as about 5.75.
//
// Both the route and the room it opens on belong to one particular hub, laid out from one seed on
// one machine's development database. Every generated room has a staircase and at least one hall
// standing open through both storeys, but no two rooms put them in the same place — so retaking
// these shots against a fresh database means reading the new room's plan and rewriting the
// coordinates below, not merely running this again.
//
// The drop reads as a drop in first person and nowhere else: the game pitches the view down over
// open space by itself, and that is what a shot of somebody looking downstairs is. It pitches down
// hard, though, so such a frame is mostly the floor below — which is why each of them is taken with
// the near edge of the floor the player is standing on inside the frame, to give that floor
// somewhere to fall away from.

const Nav = require("./nav.js");

const NORTH = Math.PI;          // toward row 0
const SOUTH = 0;                // toward row 31

const UPPER_STOREY_Y = 5.0;     // above this, the player is standing on the upper floor

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

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

// Positive brings the view closer, negative pushes it away.
async function wheel(ctx, notches)
{
    await ctx.page.mouse.move(640, 400);
    for (let i = 0; i < Math.abs(notches); ++i)
    {
        await ctx.page.mouse.wheel(0, notches > 0 ? -100 : 100);
        await ctx.sleep(350);
    }
    await ctx.sleep(700);
}

module.exports = {
    slug: "second-floor",
    devUser: 1,
    startPath: "/YmFDdgPO530syWenzRwo",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickAt, clickId, log } = ctx;
        await Nav.installPose(ctx);

        const go = async (x, z, opts) =>
        {
            const p = await Nav.goTo(ctx, x, z, Object.assign({ timeoutMs: 60000, log }, opts));
            log(`  -> ${Nav.describe(p)}   (wanted ${x}, ${z})`);
            return p;
        };

        log("start: " + Nav.describe(await Nav.pose(ctx)));

        // --- Out of the entrance hall by its east doorway, and round to the staircase. ---
        await go(22.0, 27.5);
        await go(26.5, 25.5);
        await go(26.5, 23.5, { arrive: 1.0 });   // in the doorway itself
        await go(26.5, 21.0);
        await go(23.5, 19.5);
        await go(22.5, 15.5);
        await go(22.5, 13.0);

        // --- Up the staircase. ---
        // The flight doubles back on itself: out along one lane, across at the far end, and back
        // along the other. It has to be crossed at that far end, where the two lanes are one step
        // apart; anywhere else along them they are three, which is more than a stride.
        let climbed = false;
        for (let attempt = 0; attempt < 3 && !climbed; ++attempt)
        {
            await go(22.5, 13.2);
            await go(25.5, 13.2, { arrive: 1.0 });    // the foot of the flight

            // Climbing covers ground slowly enough to look, from out here, exactly like walking
            // into a wall — so the legs on the flight are told never to strike off to one side. On
            // a staircase there is nothing to go round, and the side of one is a drop.
            const climb = { arrive: 0.9, noDetour: true, pollMs: 900, timeoutMs: 45000 };
            const up = await go(25.5, 18.4, climb);
            log(`  lane 1 top: y=${up.y.toFixed(2)}`);
            if (up.y < 2.5)
                continue;                              // stepped off the side; go round and retry

            // Aimed past the second lane rather than at it, and stopped tight. Aiming at its middle
            // with a loose arrival leaves the player short of the crossing — still on the first
            // lane, three steps below where the next leg assumes he is, and walking off the end of
            // it. The height, not the position, is what says whether he actually crossed.
            const across = await go(28.0, 18.4, Object.assign({}, climb, { arrive: 0.6 }));
            log(`  lane 2 foot: y=${across.y.toFixed(2)}`);
            if (across.y < 4.0)
                continue;
            const landing = await go(27.5, 14.6, Object.assign({}, climb, { arrive: 1.2 }));
            log(`  landing: y=${landing.y.toFixed(2)}`);
            climbed = landing.y > UPPER_STOREY_Y;
        }
        if (!climbed)
        {
            log("WARNING: never reached the upper storey");
            return;
        }

        // Standing at the top of a flight, the camera pitches down over the drop by itself.
        await Nav.faceBearing(ctx, SOUTH, { log });
        await shot("stairs");

        // --- Out onto the gallery over the hall the stairs came up beside. ---
        await go(27.5, 13.4);
        await go(22.5, 13.4);
        await go(21.5, 12.5, { arrive: 1.0 });
        await go(21.5, 11.4);
        await go(25.5, 11.4);
        await Nav.faceBearing(ctx, NORTH, { log });
        await shot("gallery");

        // --- Editing a block on the floor below, from the floor above it. ---
        // Aimed below the horizon and out over the drop, where the only thing within reach is the
        // ground floor — and where nothing stands between the camera and it to be cleared out of
        // the way, which is what leaves a hole in a shot taken down through a storey floor. The
        // orbit is only swung, never lifted: it opens at the gallery's own height looking down,
        // which is the view the shot wants, and lifting it further ends up straight overhead.
        let edited = false;
        for (const p of [{x: 640, y: 560}, {x: 560, y: 600}, {x: 720, y: 520}, {x: 640, y: 640}])
        {
            await clickAt(p);
            await sleep(1300);
            if (await visible(ctx, "startEditingButton"))
            {
                await clickId("startEditingButton");
                await sleep(2800);
                if (await visible(ctx, "addVoxelBlockButton"))
                {
                    edited = true;
                    log("block on the floor below in edit mode, clicked at " + JSON.stringify(p));
                    break;
                }
                await clickId("modeExitButton");
                await sleep(1600);
            }
        }
        if (edited)
        {
            await wheel(ctx, -3);
            await swing(ctx, -110);
            await shot("editing");
            await clickId("modeExitButton");
            await sleep(2200);
        }
        else
            log("WARNING: could not get a block on the floor below into edit mode");

        log("end: " + Nav.describe(await Nav.pose(ctx)));
    },
};
