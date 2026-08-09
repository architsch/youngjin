// The image for the dev log's opening entry. That post is about the project rather than about one
// feature, so what it wants is a single frame that says what ThingsPool is: a room made of voxel
// blocks, pictures hanging on its walls, and the editing controls that put them there.
//
// The camera is only ever pulled back off the player by selecting something, so the shot is set up
// by selecting the picture on the wall the session starts facing and then orbiting around it.

/**
 * Steering is a joystick — what matters is how long the pointer is held away from where it went
 * down, not how far it travelled — so a turn is a press, a move, and a wait.
 */
async function steer(page, dx, dy, ms)
{
    const c = { x: 640, y: 400 };
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + dx, c.y + dy, { steps: 8 });
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(350);
}

/** Whether a selection is live — the editing UI's exit button is what says so. */
async function inEditMode(page)
{
    return await page.locator("#modeExitButton").first().isVisible().catch(() => false);
}

module.exports = {
    slug: "devlog-intro",
    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickAt, drag, page } = ctx;

        // Turn away from the wall the session starts pressed against, down the length of the room.
        await steer(page, 260, 0, 1800);

        // Select what is hanging on the far wall. Where exactly it sits in frame depends on where
        // the turn ended, so a few heights along the wall are tried rather than one.
        for (const y of [400, 430, 370])
        {
            await clickAt({ x: 640, y });
            await sleep(1000);
            if (await inEditMode(page))
                break;
        }
        if (!await inEditMode(page))
            throw new Error("Nothing on the wall could be selected — the camera never left the player.");

        // Lift the camera over the selection and pull back, until the walls, the floor and the
        // rooms beyond are in frame together. Any steeper and the rooms, emptied of their ceilings
        // for the camera, show the black above them.
        await drag({ x: 640, y: 320 }, { x: 720, y: 400 }, { steps: 30 });
        await page.mouse.move(640, 400);
        await page.mouse.wheel(0, 400);
        await sleep(1200);

        await shot("editing");
    },
};
