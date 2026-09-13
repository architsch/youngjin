/**
 * Screenshots for the "Restricted Zones" dev-log post (public/devlog-2026): one sandbox gallery whose far
 * corner is zoned, shot twice:
 *   - `room`     the whole room from above head height
 *   - `boundary` eye level at the zone's edge, with both sides in frame
 * Zones are laid with `setup.restrictedZones` (the real permission check; a single-player player is its
 * own superuser), and their outlines show only in edit mode, entered via the real button.
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

        // White brick over stone: the palette a red outline reads most plainly against.
        const palette = (await setup.palettes())[2];

        const hall = await setup.stage({
            row: 10, col: 10, rows: 14, cols: 14, layers: 15,
            wallTextureIndex: palette.wall, floorTextureIndex: palette.floor,
        });

        // Its own ceiling (the sandbox's is finished in an unrelated palette).
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

        // A plinth inside the zone, since zones cover block work.
        await setup.addBlocks({ row: 19, col: 13, rows: 2, cols: 2,
            collisionLayer: 1, layers: 3, textureIndex: palette.prop });

        // Two pictures inside the zone and one outside.
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 12,
            collisionLayer: 6, metadata: { ImagePath: "1/8" } });
        await setup.addObject({ ...hall.walls["+z"], type: "Canvas", col: 15,
            collisionLayer: 6, metadata: { ImagePath: "1/12" } });
        await setup.addObject({ ...hall.walls["-x"], type: "Canvas", row: 19,
            collisionLayer: 6, metadata: { ImagePath: "1/11" } });
        await setup.addObject({ ...hall.walls["+x"], type: "Canvas", row: 18,
            collisionLayer: 6, metadata: { ImagePath: "1/4" } });

        // The door, outside the zone, with a chosen finish (otherwise random per id).
        const styles = await setup.doorStyles();
        await setup.addObject({ ...hall.walls["+z"], type: "Door", col: 21,
            metadata: { Label: "Entrance", ...styles[0] } });

        // Boards over the stone on the visitors' side, so the near half isn't bare.
        const boards = { row: 12, col: 18, rows: 6, cols: 5, collisionLayer: 0, layers: 1 };
        await setup.removeBlocks(boards);
        await setup.addBlocks({ ...boards, textureIndex: 16 });

        // The zone itself: the far corner of the room, wall included, reaching its whole height.
        const zones = await setup.restrictedZones([
            { rowMin: 17, rowMax: 23, colMin: 10, colMax: 17 },
        ]);
        log(`the room holds ${zones.length} restricted zone`);

        // `editModeButton` is on the HUD, so the HUD is shown for the click and hidden again.
        await showHUD();
        await clickId("editModeButton");
        await hideHUD();

        // ── 1. The room ─────────────────────────────────────────────────────────────────────
        // Above head height, off the corner's axis, so the zone's walls recede and the door holds the left.
        log(`room: ${(await setup.camera({
            x: 21.2, y: 3.3, z: 12.8, atX: 16.0, atY: 2.2, atZ: 20.8,
        })).distance.toFixed(1)} to the corner`);

        // Canvases load over the network; shooting too soon catches the placeholder.
        await shot("room", { settleMs: 2500 });

        // ── 2. The boundary ─────────────────────────────────────────────────────────────────
        // Eye level, close, on the open side: plinth and pictures behind the red, boards and doorway in front.
        log(`boundary: ${(await setup.camera({
            x: 20.6, y: 2.4, z: 13.9, atX: 16.2, atY: 2.0, atZ: 21.2,
        })).distance.toFixed(1)} to the corner`);
        await shot("boundary", { settleMs: 1500 });

        await setup.clearSandbox();
    },
};
