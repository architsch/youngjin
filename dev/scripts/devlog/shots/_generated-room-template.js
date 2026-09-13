/**
 * Shot-script template for a GENERATED room — the exception. Copy `_template.js` unless the shot needs:
 *   - a room the generator produced (a hub's layout, two storeys, procedural output), or
 *   - a performed flow (entering edit mode, hanging a picture via the tools, walking through a door).
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *
 * Work the shots out in a live session first (its ops are the functions called here), then write this
 * file:
 *
 *   node dev/scripts/devlog/captureRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]
 *
 * Shot scripts for published posts are kept, so their screenshots can be retaken.
 */
module.exports = {
    // Names every file the run produces: `shot("overview")` writes `<slug>-overview.jpg`.
    slug: "template",

    // Opens a generated room (seeded from a fixed seed, removed afterwards) instead of the sandbox.
    freshRoom: true,

    // Dev member 1-3, 4 for the seeded admin, or null for a new guest. Members own and may edit a room;
    // only the admin manages a hub's doors.
    devUser: 1,

    // "/" is the usual entry; "/<roomID>" opens a room directly. Ignored with --fresh-room.
    startPath: "/",

    // Room type for --fresh-room. Regular rooms are one storey, so anything upstairs or door-related needs "hub".
    roomType: "regular",

    // Set true only for a post about the tutorial itself — otherwise the tutorial is skipped.
    tutorial: false,

    // Optional; defaults to 1280x800.
    // viewport: { width: 1280, height: 800 },

    async run(ctx)
    {
        const { shot, clickId, sleep, setup, interact, log } = ctx;

        // --- Arrange the scene -------------------------------------------------------------
        // Set the player's position and the camera directly; never walk (slow and not reproducible).

        // Standable spots, nearest first. `collisionLayer: 0` is the ground floor, 8 the upper storey, and
        // the layers between are stair treads.
        const spots = await setup.standingSpots({ near: { x: 16, z: 16 }, collisionLayer: 0, limit: 5 });
        log(`nearest place to stand: ${spots[0].x}, ${spots[0].z}`);
        await setup.place(spots[0].x, spots[0].z);

        // --- Act in it ---------------------------------------------------------------------
        // The post's subject goes through real gestures, aimed from what the page reports.

        // Editing tools exist only in edit mode.
        await interact.ensureEditMode();

        // A face of wall that will actually take a picture, found by casting through the view.
        await interact.clickSurfaceUntilEnabled("addCanvasButton", { objectType: "Voxel" });
        await clickId("addCanvasButton");
        await sleep(2000);

        // Swing off square-on and lift the camera so the room recedes (relative to the mode's opening view).
        await setup.swing({ azimuthDeg: -50, polarDeg: 65, zoom: 0.8 });
        await shot("overview");
    },
};
