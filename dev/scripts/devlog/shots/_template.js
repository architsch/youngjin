/**
 * Shot-script template. Copy to `<slug>.js` beside this file and rewrite `run()` for the feature
 * the post is about, then capture with:
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *
 * Every shot script for a published post is kept, so the screenshots of a post can be taken again
 * after the feature they show has moved on.
 */
module.exports = {
    // Names every file the run produces: `shot("overview")` writes `<slug>-overview.jpg`.
    slug: "template",

    // Seeded dev member to play as (1-3), or null for a brand-new guest. A member owns a room and
    // may edit it, which is what most features need in order to be shown at all.
    devUser: 1,

    // Where to start. "/" is the player's usual entry; "/<roomID>" opens one room directly.
    startPath: "/",

    // Set true only for a post about the tutorial itself — otherwise the tutorial is skipped.
    tutorial: false,

    // Optional; defaults to 1280x800.
    // viewport: { width: 1280, height: 800 },

    async run(ctx)
    {
        const { shot, drag, center, clickId, clickAt, hold, sleep, describeUI, log } = ctx;

        // While working out what to click, print what is on screen and where it is:
        log(JSON.stringify(await describeUI(), null, 2));

        await shot("overview");

        // Orbit the camera by dragging across the world.
        const c = center();
        await drag({ x: c.x + 220, y: c.y }, { x: c.x - 220, y: c.y - 60 });
        await shot("angle");
    },
};
