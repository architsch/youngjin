// Shots for the "game mode" post: edit mode's opening view, a picture being edited, and a click on the
// same picture in play mode. The wall and picture are found by asking the page (`standingSpots`,
// `clickSurfaceUntilEnabled`) and orbits are relative, so nothing depends on one database's room.
// Each shot swings off square-on and frames its subject closely.

const CHARACTER_SWING_DEG = 135;  // A three-quarter view of the face rather than his back.
const CHARACTER_POLAR_DEG = 72;   // A shade above his own level, looking very slightly down.
const CHARACTER_ZOOM = 0.72;      // Close: the whole figure, above the tool strip.

const CANVAS_SWING_DEG = -52;     // Off square, toward the room rather than along the wall.
const CANVAS_POLAR_DEG = 68;
const CANVAS_ZOOM = 0.85;         // The near end of the range, where a picture reads properly.

// Where the picture sits in the play-mode shot, as a fraction from center to edge (a fixed turn in
// degrees would depend on the viewport).
const PLAY_OFFSET_FRACTION = 0.55;

// Distances to try standing from the picture, nearest first (farther brings a high-hung one into view).
const PLAY_DISTANCES = [3, 4.5, 6, 8];

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "game-mode",

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

        // --- Edit mode as it opens: on the user's own character. ---
        await clickId("editModeButton");
        await sleep(1200);
        await setup.swing({ azimuthDeg: CHARACTER_SWING_DEG, polarDeg: CHARACTER_POLAR_DEG,
            zoom: CHARACTER_ZOOM });
        await shot("character");

        // --- Edit mode on a picture: the orbit and the tools both go to it. ---
        // A picture-ready wall face, found by raycasting a grid over the view (moving the view when exhausted).
        await interact.clickSurfaceUntilEnabled("addCanvasButton", { objectType: "Voxel" });
        await clickId("addCanvasButton");
        await sleep(2000);
        if (!(await visible(ctx, "changeCanvasImageButton")))
            throw new Error("Hanging a picture left nothing selected to photograph.");

        await setup.swing({ azimuthDeg: CANVAS_SWING_DEG, polarDeg: CANVAS_POLAR_DEG,
            zoom: CANVAS_ZOOM });
        await shot("editing");

        // --- Play mode: a click on that same picture says what it is, and nothing more. ---
        const canvas = await interact.find({ objectType: "Canvas" });
        await clickId("modeExitButton");
        await sleep(1500);

        // Aim first (face it square on and click), compose afterwards. Vantages are tried nearest first until
        // the page reports the picture both in view (it may hang high) and in reach.
        let bearing = 0;
        let framed = null;
        for (const distance of PLAY_DISTANCES)
        {
            await setup.vantage({ x: canvas.world.x, z: canvas.world.z }, { distance });
            const pose = await setup.pose();
            bearing = Math.atan2(canvas.world.x - pose.x, canvas.world.z - pose.z) * 180 / Math.PI;
            await setup.faceDeg(bearing);

            // Uses the click's own judgement: in view, in reach, over the canvas and in line of sight are all required.
            const seen = await interact.find({ objectId: canvas.objectId });
            const problem = interact.diagnose(seen);
            if (problem == null)
            {
                framed = seen;
                log(`picture in view from ${distance} away`);
                break;
            }
            log(`  from ${distance} away it is ${problem}; standing back`);
        }
        if (framed == null)
            throw new Error("The picture could not be brought into view from anywhere in front of it.");

        await interact.clickObject({ objectId: canvas.objectId }, { approach: false });
        await sleep(1000);
        if (!(await ctx.page.getByText("Title:").first().isVisible().catch(() => false)))
            throw new Error("Clicking the picture in play mode did not raise what it is.");

        // Turn off the wall so the room enters the frame; the selection survives the turn. The turn is computed
        // from the camera (the fov is vertical, so horizontal coverage depends on the aspect ratio).
        const camera = await interact.call("camera");
        const halfWidthDeg = Math.atan(Math.tan(camera.fov * Math.PI / 360) *
            (camera.canvas.width / camera.canvas.height)) * 180 / Math.PI;
        await setup.faceDeg(bearing + halfWidthDeg * PLAY_OFFSET_FRACTION);
        await shot("play");
    },
};
