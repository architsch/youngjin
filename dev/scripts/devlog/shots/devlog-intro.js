// The image for the dev log's opening entry. That post is about the project rather than about one
// feature, so what it wants is a single frame that says what ThingsPool is: a room made of voxel
// blocks, pictures hanging on its walls, and the editing controls that put them there.
//
// It is therefore framed wider than a feature post's shots — a little back from the orbit's closest
// range rather than right in — while still following the same composition rules (see the skill's
// reference/capture.md): come round off the wall's square-on view so the room recedes, and lift the
// camera enough to see over the wall into what lies beyond it without going so high that the black
// above a ceilingless room comes into frame.
//
// The camera only ever leaves the player by selecting something in edit mode, so the shot is set up
// by picking out a picture on a wall — found by asking the page which faces are in view and in
// reach, rather than by walking into a wall and hoping a list of pixel coordinates still lands on it.

const ROOM_SWING_DEG = -52;   // Off the wall's square-on view, so the room recedes.
const ROOM_POLAR_DEG = 62;    // Lifted over the wall, to see into the room beyond.
const ROOM_ZOOM = 0.62;       // Wide enough to keep the room, close enough to read it.

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "devlog-intro",

    // A generated room rather than the sandbox: this post is about the game itself, so the picture
    // has to be taken in a room the generator made. Seeded from a fixed seed and removed afterwards.
    freshRoom: true,

    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickId, setup, interact, log } = ctx;

        // Somewhere the room actually has, near its middle, so there is wall in every direction to
        // find. Exact and instant, where walking into a wall for eighteen seconds was neither.
        const spots = await setup.standingSpots({ near: { x: 16, z: 16 }, collisionLayer: 0, limit: 1 });
        if (spots.length == 0)
            throw new Error("The room has nowhere to stand on its ground floor.");
        await setup.place(spots[0].x, spots[0].z);
        log(`standing at ${spots[0].x}, ${spots[0].z}`);

        // Edit mode first: the tools that hang a picture exist only inside it, and so does the orbit
        // that this frame is composed with. It opens on the player's own character, and the click
        // below moves the selection onto the wall.
        await clickId("editModeButton");
        await sleep(1200);

        // A face of wall that will take a picture, found by casting through the view and trying what
        // was actually struck — which is what lets this run work on whatever stretch of wall
        // generation happened to leave bare.
        await interact.clickSurfaceUntilEnabled("addCanvasButton", { objectType: "Voxel" });
        await clickId("addCanvasButton");
        await sleep(2000);
        if (!(await visible(ctx, "changeCanvasImageButton")))
            throw new Error("Nothing on the wall could be selected — the camera never left the player.");

        await setup.swing({ azimuthDeg: ROOM_SWING_DEG, polarDeg: ROOM_POLAR_DEG, zoom: ROOM_ZOOM });
        await shot("editing");
    },
};
