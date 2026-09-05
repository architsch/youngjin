/**
 * Screenshots for the "Restricted Zones" dev-log post (public/devlog-2026).
 *
 * One set, dressed once and photographed twice — a gallery whose far corner has been closed to
 * everybody but the room's own superuser:
 *
 *   - `room`     the whole room from above head height, with the zone's red block work filling the
 *                far corner and the open half, its door and its wood floor left for visitors.
 *   - `boundary` the same room from down at the line itself, so the two sides of it are in one
 *                frame: the pictures and the plinth inside the red, the doorway outside it.
 *
 * Both are sandbox frames. The zones are laid with `setup.restrictedZones`, which goes through the
 * game's own permission check — a single-player room's player is its own superuser — and the red
 * outlines are the game's, drawn by the same code that draws them in a hub. They are shown in edit
 * mode only, so the run enters the mode through the real button once the set is standing; the
 * sandbox camera is bound to no selection, so the frame survives the crossing untouched.
 *
 *   node dev/scripts/devlog/captureRunner.js dev/scripts/devlog/shots/restricted-zones.js
 */
module.exports = {
    slug: "restricted-zones",

    async run(ctx)
    {
        const { shot, setup, hideHUD, showHUD, clickId, log } = ctx;

        await hideHUD();
        await setup.texturePack("default");

        // A white brick wall over a stone floor. Of the palettes the game finishes its own rooms in
        // this is the one a red line reads most plainly against, which is the whole subject here.
        const palette = (await setup.palettes())[2];

        const hall = await setup.stage({
            row: 10, col: 10, rows: 14, cols: 14, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // Its own ceiling. The sandbox room has one, but it is finished in whatever palette the room
        // was generated from and shows above the walls as a band of an unrelated colour.
        await setup.addBlocks({ row: hall.row + 1, col: hall.col + 1,
            rows: hall.rows - 2, cols: hall.cols - 2,
            collisionLayer: 15, layers: 1, textureIndex: palette.ceiling });

        // A cornice around the top, so the four walls do not read as four flat planes.
        for (const band of [
            { row: hall.row, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + hall.rows - 1, col: hall.col + 1, rows: 1, cols: hall.cols - 2 },
            { row: hall.row + 1, col: hall.col, rows: hall.rows - 2, cols: 1 },
            { row: hall.row + 1, col: hall.col + hall.cols - 1, rows: hall.rows - 2, cols: 1 },
        ])
            await setup.addBlocks({ ...band, collisionLayer: 13, layers: 1, textureIndex: palette.prop });

        // The plinth that stands inside the zone. Block work is what a zone actually takes over, so
        // the frame wants some of it standing in there rather than only floor and wall.
        await setup.addBlocks({ row: 19, col: 13, rows: 2, cols: 2,
            collisionLayer: 1, layers: 3, textureIndex: palette.prop });

        // Two pictures inside the zone and one outside it: what a picture shows goes out of reach
        // along with the wall behind it, and that is easiest to see when there is one of each.
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 12,
            collisionLayer: 6, metadata: { ImagePath: "1/8" } });
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 15,
            collisionLayer: 6, metadata: { ImagePath: "1/12" } });
        await setup.addObject({ ...hall.walls["-x"], type: "Canvas", row: 19,
            collisionLayer: 6, metadata: { ImagePath: "1/11" } });
        await setup.addObject({ ...hall.walls["+x"], type: "Canvas", row: 18,
            collisionLayer: 6, metadata: { ImagePath: "1/4" } });

        // The way in, on the half of the wall the zone does not reach. A door left to itself takes
        // one of the twelve finishes at random from its own id, so this one is chosen.
        const styles = await setup.doorStyles();
        await setup.addObject({ ...hall.walls["+z"], type: "Door", col: 21,
            metadata: { Label: "Entrance", ...styles[0] } });

        // A stretch of boards laid over the stone, on the side of the room visitors are given. The
        // floor is a layer of blocks like any other, so re-laying part of it is a patch taken away
        // and put back — and it is what keeps the near half of the frame from being bare.
        const boards = { row: 12, col: 18, rows: 6, cols: 5, collisionLayer: 0, layers: 1 };
        await setup.removeBlocks(boards);
        await setup.addBlocks({ ...boards, textureIndex: 16 });

        // The zone itself: the far corner of the room, wall included, reaching its whole height.
        const zones = await setup.restrictedZones([
            { rowMin: 17, rowMax: 23, colMin: 10, colMax: 17 },
        ]);
        log(`the room holds ${zones.length} restricted zone`);

        // The red outlines belong to edit mode. `editModeButton` lives on the identity bar, which is
        // part of the HUD, so the HUD goes back up for the click and comes down again after.
        await showHUD();
        await clickId("editModeButton");
        await hideHUD();

        // ── 1. The room ─────────────────────────────────────────────────────────────────────
        // Inside the room, above head height and off the corner's axis, so the two walls of the
        // zone recede to a vanishing point and the door carries the left of the frame.
        log(`room: ${(await setup.camera({
            x: 21.2, y: 3.3, z: 12.8, atX: 16.0, atY: 2.2, atZ: 20.8,
        })).distance.toFixed(1)} to the corner`);

        // A canvas fetches its picture over the network and draws it once it arrives; a frame taken
        // too soon catches the placeholder, which reads as a broken game rather than a bad photograph.
        await shot("room", { settleMs: 2500 });

        // ── 2. The boundary ─────────────────────────────────────────────────────────────────
        // Down at eye level and close in, standing on the open side of the line. Both halves of the
        // room are in this one: the plinth and the pictures behind the red, the boards and the
        // doorway in front of it.
        log(`boundary: ${(await setup.camera({
            x: 20.6, y: 2.4, z: 13.9, atX: 16.2, atY: 2.0, atZ: 21.2,
        })).distance.toFixed(1)} to the corner`);
        await shot("boundary", { settleMs: 1500 });

        await setup.clearSandbox();
    },
};
