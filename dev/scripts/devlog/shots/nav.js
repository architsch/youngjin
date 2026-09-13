// Walks the player to a point, for shots where walking is the subject (e.g. climbing a staircase);
// otherwise use `ctx.setup.place` or `ctx.setup.vantage`. Closed-loop on the player's actual position,
// since headless frame rates vary too much for timed walks. The heading is set via the setup bridge.

const ARRIVE_DEFAULT = 1.6;
const POLL_MS = 400;

// Below this, a poll interval's worth of walking has not moved him: he is against something.
const MIN_PROGRESS = 0.12;

const distanceBetween = (pose, x, z) => Math.hypot(pose.x - x, pose.z - z);

/**
 * Walks to a point, correcting heading, and returns the final pose. Stops early when progress stalls (a
 * wall, but also climbing, so staircase legs pass `noStallCheck`). Only `arrived` means it got there.
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

            // The heading is corrected without interrupting the held keys.
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
