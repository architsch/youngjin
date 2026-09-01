/**
 * Shot-script template. Copy to `<slug>.js` beside this file, rewrite `run()`, and capture with:
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *
 * Work the shots out in a live session first and write this file last — the ops a session takes are
 * the same functions called here, under the same names, so it is transcription rather than
 * translation:
 *
 *   node dev/scripts/devlog/captureRunner.js --serve
 *
 * THE SET IS BUILT, NOT FOUND. A run opens in the sandbox: an empty room, 32x32 cells of bare floor,
 * whose camera is off the player entirely and whose walls, floors, pictures and doors are stood up
 * by asking for them. So a shot is composed the way a photograph is — decide the frame, build what
 * belongs in it, put the camera where the picture wants it — rather than by walking a generated room
 * until something worth photographing comes into view.
 *
 * That is what a film set is, and the honesty of the picture is unaffected by it: the thing being
 * photographed — the material, the shape, the doorway, the way two surfaces meet — is the real one,
 * spawned and drawn and lit exactly as the game does it. What was built is the room it stands in.
 *
 * Copy `_generated-room-template.js` instead in the one case that needs it: when the subject is a
 * room the *generator* produced — how a hub is laid out, what two storeys look like — or when the
 * post is about a flow the shot has to actually perform. Everything else belongs here.
 */
module.exports = {
    // Names every file the run produces: `shot("overview")` writes `<slug>-overview.jpg`.
    slug: "template",

    // Optional; defaults to 1280x800.
    // viewport: { width: 1280, height: 800 },

    async run(ctx)
    {
        const { shot, setup, hideHUD, log } = ctx;

        // The interface is not in this picture so much as in the way: the chat bar takes the bottom
        // of the frame and the seat's name the corner, and neither is what the shot is of. Leave it
        // in only for a post about the interface itself.
        await hideHUD();

        // --- Choose what the set is made of -------------------------------------------------
        // A palette is a set of texture indices the game finishes its own rooms in — a floor, a
        // ceiling, a wall and a prop chosen to go together. Dressing a set out of one is what makes
        // it look like somewhere rather than like a paint chart.
        await setup.texturePack("default");
        const palettes = await setup.palettes();
        const palette = palettes[1]; // pick the one whose floor and wall differ most for this shot
        log(`palette: floor ${palette.floor}, wall ${palette.wall}, prop ${palette.prop}`);

        // --- Build the set ------------------------------------------------------------------
        // Four walls around a rectangle of floor, with the near side left open. A collision layer is
        // half a cell tall, so 12 of them stand six cells high — tall enough that the camera does
        // not see over the wall into the black above the room, which is what a lower one leaves as a
        // band across the top of the frame.
        const stage = await setup.stage({
            row: 14, col: 14, rows: 9, cols: 11, layers: 12,
            wallTextureIndex: palette.wall,
            floorTextureIndex: palette.floor,
            open: ["-z"],
        });

        // Furniture, so the frame holds several things the eye can tell apart. A picture on the back
        // wall and a door in the side one are the cheapest pair that makes a set read as a room.
        //
        // Both are hung off `stage.walls`, which names each wall's own cells and the face of them
        // that looks into the room. Working those out by hand is the easy mistake and a silent one:
        // an object hung on the cell one *in front* of a wall hangs on nothing.
        await setup.addObject({
            ...stage.walls["+z"], type: "Canvas", col: stage.col + 5, collisionLayer: 4,
            metadata: { ImagePath: "1/14" }, // van Gogh's self portrait; setup.pictures() lists them
        });
        // No `y`: a door stands on the floor in front of the wall, with its bottom edge on the line
        // where the two meet, and that height is worked out for it. Give one only for a door meant
        // to sit somewhere else.
        await setup.addObject({
            ...stage.walls["+x"], type: "Door", row: stage.row + 4,
            metadata: { Label: "Library" },
        });

        // Whatever the post is actually about goes here — a plinth and the subject on top of it.
        await setup.addBlocks({
            row: stage.row + 4, col: stage.col + 5, collisionLayer: 1,
            rows: 2, cols: 2, layers: 1, textureIndex: palette.prop,
        });

        // --- Point the camera at it ---------------------------------------------------------
        // Stated in world coordinates rather than arrived at: no orbit to swing around a subject and
        // no walking to a vantage. Off to one side and a little above, which is the angle that shows
        // a box as a box rather than as a square.
        //
        // Stand it *inside* the set, not out in the dark looking in: a camera behind the open side
        // photographs the outside of the near wall for a third of the frame. Four to eight units off
        // the subject is the range that fills a frame with it.
        const subject = { x: stage.col + 6, y: stage.floorY + 1.0, z: stage.row + 5 };
        const view = await setup.camera({
            x: subject.x - 3.2, y: stage.floorY + 1.8, z: subject.z - 3.2,
            atX: subject.x, atY: subject.y, atZ: subject.z,
        });
        log(`camera ${view.distance.toFixed(1)} away from what it is aimed at`);

        await shot("subject");

        // --- And again, for the next one ----------------------------------------------------
        // One run arranges several shots; `clearSandbox` takes the set back to bare floor and puts
        // the camera back, so the second does not inherit the first one's scenery.
        await setup.clearSandbox();
    },
};
