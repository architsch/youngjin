// Shots for the "game mode" post: what edit mode opens on, what a picture looks like while it is
// being edited, and what a click on that same picture amounts to in play mode.
//
// The three shots need the player standing at a wall with a picture on it. Where that wall is
// depends on the room that was generated, so nothing about it can be written down in advance —
// which is why the page is asked. `standingSpots` says where there is floor, `clickSurfaceUntilEnabled`
// finds a face of wall that will actually take a picture, and the orbit is set in degrees off
// whatever view the mode opened at. None of it is a coordinate that only means something in one
// database, and none of it is a distance measured in held keys.
//
// The two composition rules are still in the numbers: each shot comes round off the square-on view
// rather than standing perpendicular to the wall, and each is framed close enough that its subject
// fills a good part of the frame.

const CHARACTER_SWING_DEG = 135;  // A three-quarter view of the face rather than his back.
const CHARACTER_POLAR_DEG = 72;   // A shade above his own level, looking very slightly down.
const CHARACTER_ZOOM = 0.72;      // Close: the whole figure, above the tool strip.

const CANVAS_SWING_DEG = -52;     // Off square, toward the room rather than along the wall.
const CANVAS_POLAR_DEG = 68;
const CANVAS_ZOOM = 0.85;         // The near end of the range, where a picture reads properly.

// How far across the frame the picture should sit in the play-mode shot, as a fraction of the way
// from the centre to the edge. Far enough over that the room fills the rest of the frame, near
// enough in that the picture is not cut by the edge — which is what a turn written as a fixed number
// of degrees gets wrong, since how many degrees reach the edge depends on the viewport.
const PLAY_OFFSET_FRACTION = 0.55;

// How far off the picture to try standing for the play-mode frame, nearest first. Near enough that
// it fills the frame; far enough, at the back of the list, to bring a high-hung one into view.
const PLAY_DISTANCES = [3, 4.5, 6, 8];

const visible = (ctx, id) => ctx.page.locator(`#${id}`).first().isVisible().catch(() => false);

module.exports = {
    slug: "game-mode",

    // A generated room rather than the sandbox: this post is about the game itself, so the picture
    // has to be taken in a room the generator made. Seeded from a fixed seed and removed afterwards.
    freshRoom: true,

    devUser: 1,
    startPath: "/",
    tutorial: false,
    async run(ctx)
    {
        const { shot, sleep, clickId, setup, interact, log } = ctx;

        // Somewhere with floor, near the middle of the room, from which there is wall in every
        // direction to look for. Standing somewhere the room actually has rather than wherever a
        // timed walk happened to end is the whole difference between a run that repeats and one
        // that does not.
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
        // A face of wall that will take a picture, found by asking rather than by sweeping candidate
        // pixels: the search casts a ray through a grid over the view and tries the surfaces it
        // actually hit, moving the view when a whole view of them is exhausted.
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

        // Aiming and composing are two different jobs, and doing them in one turn does neither: a
        // picture framed off to the side of the shot is a picture near the edge of what can be
        // clicked at all. So it is faced square on and clicked first, and the frame is composed
        // afterwards.
        //
        // How far off to stand is settled by looking rather than by choosing a number. Turning to
        // face a point puts it at the middle of the frame horizontally and says nothing about
        // vertically: the picture may have been hung high on the wall, and standing close then
        // leaves it above the top of the view — outside the field of view, which is a click that
        // would do nothing. Backing off brings more of the wall into frame, so the vantages are
        // tried in turn until the page says the picture is both in view and in reach.
        let bearing = 0;
        let framed = null;
        for (const distance of PLAY_DISTANCES)
        {
            await setup.vantage({ x: canvas.world.x, z: canvas.world.z }, { distance });
            const pose = await setup.pose();
            bearing = Math.atan2(canvas.world.x - pose.x, canvas.world.z - pose.z) * 180 / Math.PI;
            await setup.faceDeg(bearing);

            // Asked through the same judgement the click itself makes, rather than by testing a few
            // of the fields it looks at: in view, in reach, over the canvas and *in line of sight*
            // are four separate ways to be unclickable, and a check that covers three of them passes
            // a vantage the click then refuses.
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

        // Now off the wall, so the room and its doorway open into the frame beside the picture
        // instead of a blank stretch of wall taking up half of it. The selection is held by what was
        // clicked, not by where he happens to be looking, so it survives the turn.
        //
        // How far to turn is worked out from the camera rather than written down: the fov is
        // vertical, so how much of the world fits across the frame depends on its shape, and a turn
        // that composes nicely at one viewport carries the subject off the edge at another.
        const camera = await interact.call("camera");
        const halfWidthDeg = Math.atan(Math.tan(camera.fov * Math.PI / 360) *
            (camera.canvas.width / camera.canvas.height)) * 180 / Math.PI;
        await setup.faceDeg(bearing + halfWidthDeg * PLAY_OFFSET_FRACTION);
        await shot("play");
    },
};
