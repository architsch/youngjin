/**
 * Shot-script template for a GENERATED room — the exception, not the usual case. Copy `_template.js`
 * unless the shot needs one of the two things only this can give:
 *
 *   - the subject is a room the *generator* produced. How a hub is laid out, what two storeys look
 *     like, what procedural generation actually makes. A set built by hand cannot show that, because
 *     what it shows is what was built.
 *   - the shot has to perform a flow. Entering edit mode, hanging a picture through the tools,
 *     walking through a door — anything where the picture is of the game being used.
 *
 * Everything else is quicker, steadier and better composed in the sandbox, where the set is built to
 * suit the frame instead of the frame being fitted to whatever the search turned up.
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *
 * Work the shots out in a live session first and write this file last — the ops a session takes are
 * the same functions called here, under the same names, so it is transcription rather than
 * translation:
 *
 *   node dev/scripts/devlog/captureRunner.js --serve --fresh-room [--room-type=hub] [--devuser=4]
 *
 * Every shot script for a published post is kept, so the screenshots of a post can be taken again
 * after the feature they show has moved on.
 */
module.exports = {
    // Names every file the run produces: `shot("overview")` writes `<slug>-overview.jpg`.
    slug: "template",

    // What opens a generated room rather than the sandbox, which is what a run gets by default. It
    // is seeded from a fixed seed before the run and removed after, so the room is the same on any
    // machine and inherits nothing from the last run.
    freshRoom: true,

    // Seeded dev member to play as (1-3), 4 for the seeded admin, or null for a brand-new guest. A
    // member owns a room and may edit it; only the admin can manage a hub's doors.
    devUser: 1,

    // Where to start. "/" is the player's usual entry; "/<roomID>" opens one room directly. Ignored
    // when the run is given --fresh-room, which opens on the room it seeded.
    startPath: "/",

    // Which kind of room --fresh-room should generate. A Regular room is built one storey tall on
    // purpose, so anything upstairs — a gallery, a staircase, a room seen from above — and anything
    // to do with doors needs "hub".
    roomType: "regular",

    // Set true only for a post about the tutorial itself — otherwise the tutorial is skipped.
    tutorial: false,

    // Optional; defaults to 1280x800.
    // viewport: { width: 1280, height: 800 },

    async run(ctx)
    {
        const { shot, clickId, sleep, setup, interact, log } = ctx;

        // --- Arrange the scene -------------------------------------------------------------
        // Set where the player stands and where the camera looks from; never walk there. Standing
        // somewhere is a precondition of the shot, not the thing being photographed, and a held walk
        // key costs the better part of a minute and lands somewhere different every run.

        // Everywhere in this room the player could stand, nearest first. `collisionLayer: 0` is the
        // ground floor and 8 the storey above; the layers between are a staircase's treads.
        const spots = await setup.standingSpots({ near: { x: 16, z: 16 }, collisionLayer: 0, limit: 5 });
        log(`nearest place to stand: ${spots[0].x}, ${spots[0].z}`);
        await setup.place(spots[0].x, spots[0].z);

        // --- Act in it ---------------------------------------------------------------------
        // Everything that the post is actually about goes through a real gesture, aimed from what
        // the page reports rather than from a coordinate written down on a previous run.

        // The editing tools exist only inside edit mode; in play mode a wall face offers only
        // "Start Editing".
        await interact.ensureEditMode();

        // A face of wall that will actually take a picture, found by casting through the view.
        await interact.clickSurfaceUntilEnabled("addCanvasButton", { objectType: "Voxel" });
        await clickId("addCanvasButton");
        await sleep(2000);

        // Come round off the square-on view and lift the camera, so the room recedes instead of
        // reading as a flat backdrop. Relative to whatever view the mode opened at.
        await setup.swing({ azimuthDeg: -50, polarDeg: 65, zoom: 0.8 });
        await shot("overview");
    },
};
