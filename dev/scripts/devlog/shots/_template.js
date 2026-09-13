/**
 * Shot-script template. Copy to `<slug>.js` beside this file, rewrite `run()`, and capture with:
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/<slug>.js
 *
 * Work the shots out in a live session first (its ops are the functions called here), then write this
 * file:
 *
 *   node dev/scripts/devlog/captureRunner.js --serve
 *
 * THE SET IS BUILT, NOT FOUND. Runs open in the sandbox: an empty 32x32 room with a free camera, where
 * walls, floors, pictures and doors are placed on request. Decide the frame, build what belongs in it,
 * and place the camera. The subject is rendered by the real game; only its surroundings are staged.
 *
 * Use `_generated-room-template.js` only for a room the generator produced or a flow the shot performs.
 */
module.exports = {
    // Names every file the run produces: `shot("overview")` writes `<slug>-overview.jpg`.
    slug: "template",

    // Optional; defaults to 1280x800.
    // viewport: { width: 1280, height: 800 },

    async run(ctx)
    {
        const { shot, setup, hideHUD, log } = ctx;

        // The HUD is in the way here; keep it only for posts about the interface.
        await hideHUD();

        // --- Choose what the set is made of -------------------------------------------------
        // A palette is a matched floor/ceiling/wall/prop texture set, so the set looks like a place.
        await setup.texturePack("default");
        const palettes = await setup.palettes();
        const palette = palettes[1]; // pick the one whose floor and wall differ most for this shot
        log(`palette: floor ${palette.floor}, wall ${palette.wall}, prop ${palette.prop}`);

        // --- Build the set ------------------------------------------------------------------
        // Four walls around a floor, near side open. A collision layer is half a cell, so 12 layers stand
        // six cells high: tall enough to hide the black above the room.
        const stage = await setup.stage({
            row: 14, col: 14, rows: 9, cols: 11, layers: 12,
            wallTextureIndex: palette.wall,
            floorTextureIndex: palette.floor,
            open: ["-z"],
        });

        // A back-wall picture and a side-wall door are the cheapest furniture that reads as a room. Hang
        // objects via `stage.walls` (each wall's cells and inward face): a cell in front of a wall hangs on nothing.
        await setup.addObject({
            ...stage.walls["+z"], type: "Canvas", col: stage.col + 5, collisionLayer: 4,
            metadata: { ImagePath: "1/14" }, // van Gogh's self portrait; setup.pictures() lists them
        });
        // No `y`: a door's bottom edge is placed on the floor line automatically. Give one only to place it elsewhere.
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
        // World coordinates, to one side and a little above (shows a box as a box). Stand inside the set
        // (from behind the open side the near wall fills the frame), four to eight units from the subject.
        const subject = { x: stage.col + 6, y: stage.floorY + 1.0, z: stage.row + 5 };
        const view = await setup.camera({
            x: subject.x - 3.2, y: stage.floorY + 1.8, z: subject.z - 3.2,
            atX: subject.x, atY: subject.y, atZ: subject.z,
        });
        log(`camera ${view.distance.toFixed(1)} away from what it is aimed at`);

        await shot("subject");

        // --- And again, for the next one ----------------------------------------------------
        // `clearSandbox` resets to bare floor and resets the camera between shots.
        await setup.clearSandbox();
    },
};
