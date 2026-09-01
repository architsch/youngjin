/**
 * Screenshots for the "Dynamic Doors" dev-log post (public/devlog-2026).
 *
 * Two sets, built in the sandbox and photographed:
 *
 *   - `room`    a hall whose walls carry doors on three sides, each one named and finished
 *               differently. The post's opening claim is that rooms now open onto one another, so
 *               the frame has to hold several doors at once and show that no two are alike.
 *   - `placing` a corridor of doors receding away, which is what "navigating a vast labyrinth of
 *               rooms" looks like when it is a picture rather than a sentence.
 *
 * The third image the post carries, `finish`, is the door-customizing panel — a picture of the
 * admin's tools rather than of a room, so it cannot be taken here. It has a script of its own:
 * `dynamic-doors-admin.js`, which opens a generated hub on the admin seat and performs the gestures.
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

        // "oak hall" — a warm stone wall over a wood floor, which is the pair with the most contrast
        // between the two big surfaces every one of these frames is mostly made of.
        const palette = (await setup.palettes())[1];
        const timber = palette.prop;

        // The twelve finishes a door can be given. Chosen rather than left to chance: a door nobody
        // picks the colors of takes one at random from its own id, and in a post whose whole subject
        // is that doors are customizable, the dice regularly hand three in a row the same paint.
        const styles = await setup.doorStyles();

        // ── 1. The hall ─────────────────────────────────────────────────────────────────────
        const hall = await setup.stage({
            row: 12, col: 11, rows: 12, cols: 14, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // A step running the whole width of the far wall. It is what the three doors along that wall
        // stand on — `addObject` takes a door's height from the floor in front of it, so the step
        // raises them together and their bottom edges stay on the line where wall meets floor.
        await setup.addBlocks({ ...hall.walls["+z"], row: hall.walls["+z"].row - 1,
            col: hall.col + 1, cols: hall.cols - 2, collisionLayer: 1, layers: 1, textureIndex: timber });

        // Pilasters between the doorways, turning a flat wall into three recessed bays. They stand
        // clear of every door: block work in front of one would hide it, and `addObject` refuses
        // that outright rather than letting it into the frame.
        for (const col of [16, 20])
        {
            await setup.addBlocks({ row: hall.walls["+z"].row - 1, col,
                collisionLayer: 1, layers: 11, textureIndex: timber });
        }

        // A cornice around the top of the room, which is what stops the walls reading as four flat
        // planes meeting at the ceiling.
        for (const band of [
            { row: hall.row + 1, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + hall.rows - 2, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + 1, col: hall.col + 1, rows: hall.rows - 3, cols: 1 },
            { row: hall.row + 1, col: hall.col + hall.cols - 2, rows: hall.rows - 3, cols: 1 },
        ])
            await setup.addBlocks({ ...band, collisionLayer: 12, layers: 1, textureIndex: timber });

        // A runner down the middle of the floor: the floor is a layer of blocks like any other, so
        // re-laying a strip of it in another material is a strip taken away and put back.
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

        // A ceiling of its own. The sandbox room has one already, but it is finished in whatever
        // palette the room was generated from rather than in the one this set is dressed out of —
        // and it shows above the walls as a band of an unrelated colour.
        await setup.addBlocks({ row: hall.row + 1, col: hall.col + 1,
            rows: hall.rows - 2, cols: hall.cols - 2,
            collisionLayer: 15, layers: 1, textureIndex: palette.ceiling });

        // Paintings high in the two bays, so the wall above the doors carries something.
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 14,
            collisionLayer: 10, metadata: { ImagePath: "1/11" } });
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 18,
            collisionLayer: 10, metadata: { ImagePath: "1/22" } });

        // Inside the room and off to one side, so the far wall runs away to a vanishing point and
        // the near corner carries the left of the frame.
        log(`hall: ${(await setup.camera({
            x: 14.6, y: 2.7, z: 15.4, atX: 19.5, atY: 2.9, atZ: 22.4,
        })).distance.toFixed(1)} to the far wall`);

        // A canvas fetches its picture over the network and draws it once it arrives, so a frame
        // taken too soon after one goes up catches the placeholder — an empty white rectangle in the
        // middle of the shot, which is the one fault here that looks like a broken game rather than
        // a badly composed picture.
        await shot("room", { settleMs: 2500 });

        // ── 2. The corridor ─────────────────────────────────────────────────────────────────
        await setup.clearSandbox();

        const hallway = await setup.stage({
            row: 7, col: 15, rows: 20, cols: 5, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // Doors down both sides, staggered so that neither wall answers the other, and one closing
        // the far end. Seven finishes and seven names, which is the point of the frame.
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

        // Its own ceiling, then bands across it between the doorways — the corridor equivalent of
        // the hall's cornice, and what gives the length of it a rhythm to recede along.
        await setup.addBlocks({ row: hallway.row + 1, col: hallway.col + 1,
            rows: hallway.rows - 2, cols: hallway.cols - 2,
            collisionLayer: 15, layers: 1, textureIndex: palette.ceiling });
        for (let row = 9; row <= 25; row += 2)
        {
            await setup.addBlocks({ row, col: hallway.col + 1, rows: 1, cols: hallway.cols - 2,
                collisionLayer: 14, layers: 1, textureIndex: timber });
        }

        // A runner the length of it, for the same reason the hall has one: a corridor of one
        // material photographs as a tunnel of one colour however good the perspective is.
        const hallwayRunner = { row: hallway.row + 1, col: 17, rows: hallway.rows - 2, cols: 1,
            collisionLayer: 0, layers: 1 };
        await setup.removeBlocks(hallwayRunner);
        await setup.addBlocks({ ...hallwayRunner, textureIndex: 52 });

        // Near the middle of the corridor's width rather than against one wall: off-axis enough that
        // the two sides do not mirror each other, close enough to centre that the nearest door is
        // not a slab across the edge of the frame.
        log(`corridor: ${(await setup.camera({
            x: 17.1, y: 2.6, z: 9.6, atX: 17.9, atY: 1.9, atZ: 24.5,
        })).distance.toFixed(1)} down its length`);
        await shot("placing");

        await setup.clearSandbox();
    },
};
