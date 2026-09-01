// Walking the player somewhere, for the shots that want the walk itself.
//
// Almost none of them do. Where a shot is *of* something, the way to get in front of it is
// `ctx.setup.place` or `ctx.setup.vantage`, which put the player down exactly and instantly; a
// photograph is not evidence about locomotion, and spending a minute of held keys to compose one
// buys nothing but a vantage that comes out slightly different every run. What remains here is for
// the case where the walking is the subject — a shot of the player crossing his own room, a run
// checking that a staircase can in fact be climbed.
//
// Even then it is a closed loop rather than a stopwatch. The game advances by wall-clock time and
// the headless renderer's frame rate varies by more than tenfold between runs, so the same held key
// covers a wildly different distance each time; a route tuned by timing works once and never again.
// This watches where the player actually is and stops when he is there.
//
// What it no longer does is work out how to turn. The heading is set exactly through the setup
// bridge, so there is no gain to measure and no sign to discover — the two things the old version of
// this file spent most of itself learning, and re-learning, every run.

const ARRIVE_DEFAULT = 1.6;
const POLL_MS = 400;

// Below this, a poll interval's worth of walking has not moved him: he is against something.
const MIN_PROGRESS = 0.12;

const distanceBetween = (pose, x, z) => Math.hypot(pose.x - x, pose.z - z);

/**
 * Walks the player to a point, correcting his heading as he goes, and gives back the pose he
 * finished at. Stops early when he stops making ground, which is what walking into a wall looks
 * like from here — and, deliberately, what climbing looks like too, so a leg that goes up a
 * staircase should be given `noStallCheck`.
 *
 * The caller is told what happened rather than left to infer it: `arrived` is the only outcome that
 * means the point was reached.
 */
async function walkTo(ctx, x, z, options = {})
{
    const arrive = options.arrive === undefined ? ARRIVE_DEFAULT : options.arrive;
    const deadline = Date.now() + (options.timeoutMs || 45_000);
    const log = options.log || (() => {});

    // Exact, and free: there is no reason to steer toward a bearing that can simply be taken up.
    await ctx.setup.face(x, z);

    await ctx.page.keyboard.down("ArrowUp");
    try
    {
        let last = await ctx.setup.pose();
        while (Date.now() < deadline)
        {
            await ctx.sleep(POLL_MS);
            const pose = await ctx.setup.pose();
            const remaining = distanceBetween(pose, x, z);
            if (remaining <= arrive)
            {
                log(`  walked to ${pose.x.toFixed(1)}, ${pose.z.toFixed(1)}`);
                return {outcome: "arrived", pose, remaining};
            }

            const moved = distanceBetween(last, pose.x, pose.z);
            last = pose;

            if (moved < MIN_PROGRESS && !options.noStallCheck)
            {
                log(`  blocked at ${pose.x.toFixed(1)}, ${pose.z.toFixed(1)}, ` +
                    `${remaining.toFixed(1)} short of ${x}, ${z}`);
                return {outcome: "blocked", pose, remaining};
            }

            // Held keys and a turn are independent controls, so the heading is put right without
            // the walk being interrupted.
            const bearing = Math.atan2(x - pose.x, z - pose.z) * 180 / Math.PI;
            let error = bearing - pose.headingDeg;
            while (error > 180) error -= 360;
            while (error < -180) error += 360;
            if (Math.abs(error) > 15)
                await ctx.setup.face(x, z);
        }

        const pose = await ctx.setup.pose();
        log(`  timed out ${distanceBetween(pose, x, z).toFixed(1)} short of ${x}, ${z}`);
        return {outcome: "timedOut", pose, remaining: distanceBetween(pose, x, z)};
    }
    finally
    {
        await ctx.page.keyboard.up("ArrowUp");
        await ctx.sleep(250);
    }
}

const describe = (pose) => pose == null ? "(no pose)" :
    `x=${pose.x.toFixed(1)} y=${pose.y.toFixed(2)} z=${pose.z.toFixed(1)} ` +
    `heading=${pose.headingDeg.toFixed(0)}deg`;

module.exports = { walkTo, describe };
