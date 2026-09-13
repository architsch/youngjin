// The dev log's opening image: one wider frame showing what ThingsPool is — a voxel room, pictures on its
// walls, and the editing controls. Composed per the skill's reference/capture.md (off square-on, lifted,
// without the black above the room). The camera leaves the player only via an edit-mode selection, so a
// wall is found by probing visible faces.

const ROOM_SWING_DEG = -52;   // Off the wall's square-on view, so the room recedes.
const ROOM_POLAR_DEG = 62;    // Lifted over the wall, to see into the room beyond.
const ROOM_ZOOM = 0.62;       // Wide enough to keep the room, close enough to read it.

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "devlog-intro",

    // A generated room (the post is about the game itself), seeded and removed afterwards.
    freshRoom: true,

    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickId, setup, interact, log } = ctx;

        // A real standable spot near the middle, with wall in every direction.
        const spots = await setup.standingSpots({ near: { x: 16, z: 16 }, collisionLayer: 0, limit: 1 });
        if (spots.length == 0)
            throw new Error("The room has nowhere to stand on its ground floor.");
        await setup.place(spots[0].x, spots[0].z);
        log(`standing at ${spots[0].x}, ${spots[0].z}`);

        // Edit mode first: it holds the tools and the orbit. It opens on the character; the click below
        // selects the wall.
        await clickId("editModeButton");
        await sleep(1200);

        // A wall face that accepts a picture, found by casting through the view and trying what's hit.
        await interact.clickSurfaceUntilEnabled("addCanvasButton", { objectType: "Voxel" });
        await clickId("addCanvasButton");
        await sleep(2000);
        if (!(await visible(ctx, "changeCanvasImageButton")))
            throw new Error("Nothing on the wall could be selected — the camera never left the player.");

        await setup.swing({ azimuthDeg: ROOM_SWING_DEG, polarDeg: ROOM_POLAR_DEG, zoom: ROOM_ZOOM });
        await shot("editing");
    },
};
