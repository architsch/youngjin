/**
 * Screenshots for the "Dynamic Doors" dev-log post (public/devlog-2026), as two sandbox sets:
 *   - `room`    a hall with differently named and finished doors on three sides
 *   - `placing` a corridor of doors receding into the distance
 * The third image, `finish` (the admin's door panel), comes from `dynamic-doors-admin.js`.
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/dynamic-doors.js
 */
module.exports = {
    slug: "dynamic-doors",

    async run(ctx)
    {
        const { shot, setup, hideHUD, log } = ctx;

        await hideHUD();
        await setup.texturePack("default");

        // "oak hall": warm stone walls over wood, the highest-contrast pair for these frames.
        const palette = (await setup.palettes())[1];
        const timber = palette.prop;

        // Door finishes, chosen explicitly (random per-id finishes often repeat).
        const styles = await setup.doorStyles();

        // ── 1. The hall ─────────────────────────────────────────────────────────────────────
        const hall = await setup.stage({
            row: 12, col: 11, rows: 12, cols: 14, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // A step along the far wall. `addObject` sets a door's height from the floor in front of it, so the
        // doors on that wall stay on the floor line.
        await setup.addBlocks({ ...hall.walls["+z"], row: hall.walls["+z"].row - 1,
            col: hall.col + 1, cols: hall.cols - 2, collisionLayer: 1, layers: 1, textureIndex: timber });

        // Pilasters between the doorways, clear of every door (`addObject` refuses doors blocked by block work).
        for (const col of [16, 20])
        {
            await setup.addBlocks({ row: hall.walls["+z"].row - 1, col,
                collisionLayer: 1, layers: 11, textureIndex: timber });
        }

        // A cornice, so the walls don't read as flat planes.
        for (const band of [
            { row: hall.row + 1, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + hall.rows - 2, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + 1, col: hall.col + 1, rows: hall.rows - 3, cols: 1 },
            { row: hall.row + 1, col: hall.col + hall.cols - 2, rows: hall.rows - 3, cols: 1 },
        ])
            await setup.addBlocks({ ...band, collisionLayer: 12, layers: 1, textureIndex: timber });

        // A floor runner: a strip of floor blocks re-laid in another material.
        const runner = { row: hall.row + 1, col: 17, rows: hall.rows - 2, cols: 3, collisionLayer: 0, layers: 1 };
        await setup.removeBlocks(runner);
        await setup.addBlocks({ ...runner, textureIndex: 52 });

        // Three doors along the far wall and one on each side, no two finished alike.
        const hallDoors = [
            { ...hall.walls["+z"], col: 14, label: "Great Hall", style: 0 },
            { ...hall.walls["+z"], col: 18, label: "Observatory", style: 5 },
            { ...hall.walls["+z"], col: 22, label: "The Underworld", style: 1 },
            { ...hall.walls["-x"], row: 16, label: "The Gallery", style: 7 },
            { ...hall.walls["+x"], row: 19, label: "Cellar", style: 4 },
        ];
        for (const door of hallDoors)
        {
            const { label, style, ...where } = door;
            await setup.addObject({ type: "Door", ...where,
                metadata: { Label: label, ...styles[style] } });
        }

        // Its own ceiling (the sandbox's is finished in an unrelated palette).
        await setup.addBlocks({ row: hall.row + 1, col: hall.col + 1,
            rows: hall.rows - 2, cols: hall.cols - 2,
            collisionLayer: 15, layers: 1, textureIndex: palette.ceiling });

        // Paintings high in the two bays, so the wall above the doors carries something.
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 14,
            collisionLayer: 10, metadata: { ImagePath: "1/11" } });
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 18,
            collisionLayer: 10, metadata: { ImagePath: "1/22" } });

        // Inside the room, off to one side, so the far wall recedes.
        log(`hall: ${(await setup.camera({
            x: 14.6, y: 2.7, z: 15.4, atX: 19.5, atY: 2.9, atZ: 22.4,
        })).distance.toFixed(1)} to the far wall`);

        // Canvases load their image over the network; shooting too soon catches a white placeholder.
        await shot("room", { settleMs: 2500 });

        // ── 2. The corridor ─────────────────────────────────────────────────────────────────
        await setup.clearSandbox();

        const hallway = await setup.stage({
            row: 7, col: 15, rows: 20, cols: 5, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // Staggered doors on both sides and one at the end: seven finishes and names.
        const corridorDoors = [
            { ...hallway.walls["-x"], row: 11, label: "Library", style: 2 },
            { ...hallway.walls["-x"], row: 15, label: "Workshop", style: 6 },
            { ...hallway.walls["-x"], row: 19, label: "The Vaults", style: 1 },
            { ...hallway.walls["+x"], row: 13, label: "Conservatory", style: 4 },
            { ...hallway.walls["+x"], row: 17, label: "Map Room", style: 8 },
            { ...hallway.walls["+x"], row: 21, label: "Attic Stair", style: 11 },
            { ...hallway.walls["+z"], col: 17, label: "The Long Gallery", style: 3 },
        ];
        for (const door of corridorDoors)
        {
            const { label, style, ...where } = door;
            await setup.addObject({ type: "Door", ...where,
                metadata: { Label: label, ...styles[style] } });
        }

        // A ceiling and bands between the doorways, giving the corridor a rhythm.
        await setup.addBlocks({ row: hallway.row + 1, col: hallway.col + 1,
            rows: hallway.rows - 2, cols: hallway.cols - 2,
            collisionLayer: 15, layers: 1, textureIndex: palette.ceiling });
        for (let row = 9; row <= 25; row += 2)
        {
            await setup.addBlocks({ row, col: hallway.col + 1, rows: 1, cols: hallway.cols - 2,
                collisionLayer: 14, layers: 1, textureIndex: timber });
        }

        // A runner, so the corridor isn't one color.
        const hallwayRunner = { row: hallway.row + 1, col: 17, rows: hallway.rows - 2, cols: 1,
            collisionLayer: 0, layers: 1 };
        await setup.removeBlocks(hallwayRunner);
        await setup.addBlocks({ ...hallwayRunner, textureIndex: 52 });

        // Near the corridor's center line but off-axis, so the sides don't mirror and the nearest door isn't cut off.
        log(`corridor: ${(await setup.camera({
            x: 17.1, y: 2.6, z: 9.6, atX: 17.9, atY: 1.9, atZ: 24.5,
        })).distance.toFixed(1)} down its length`);
        await shot("placing");

        await setup.clearSandbox();
    },
};
