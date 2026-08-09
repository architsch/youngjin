import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import RoomGenerationPaletteMap from "../maps/roomGenerationPaletteMap";
import Room from "../types/room";
import RoomGenerationPalette from "../types/roomGeneration/roomGenerationPalette";
import RoomGenerationRect from "../types/roomGeneration/roomGenerationRect";
import RoomGenerationRegion from "../types/roomGeneration/roomGenerationRegion";
import RoomGenerationVoxelGrid from "../types/roomGeneration/roomGenerationVoxelGrid";
import RoomGenerationDecorUtil from "./roomGenerationDecorUtil";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";
import RoomGenerationLayoutUtil from "./roomGenerationLayoutUtil";

// Builds a whole multiplayer room out of the room generation system's parts. This is the recipe
// layer: it decides what a multiplayer room is made of, and leaves the how to the layout and
// decoration utils.
//
// See @docs/geometry/room_generation.md .

const MIN_REGION_SIZE = 7; // no generated room comes out narrower than this, so every one of them stays walkable
const MIN_SPLIT_DEPTH = 2;
const MAX_SPLIT_DEPTH = 3;
const MIN_HALL_DEPTH = 6;
const MAX_HALL_DEPTH = 9;
const MIN_CANVASES = 10;
const MAX_CANVASES = 21;

// The stretch of floor the entrance opens onto is never built on and never hung with anything.
// That keeps an arriving player from being boxed in whichever way the rest of the room came
// out, and keeps generated content clear of the cells that room editing protects
// (see @docs/geometry/room_entrance.md).
const ENTRANCE_CLEARANCE: RoomGenerationRect = {
    rowStart: NUM_VOXEL_ROWS - 6, colStart: MULTI_PLAYER_ENTRANCE_VOXEL_COL - 2,
    numRows: 6, numCols: 5,
};

const ProceduralRoomGenerationUtil =
{
    // Lays out a complete multiplayer room: an open hall behind the entrance, a handful of
    // differently finished rooms beyond it joined by archways, decorative block work standing
    // in some of them, and paintings hung on the walls. The room's own texture pack is drawn
    // here too, since every texture the layout picks is a position within one specific pack's
    // atlas and only reads as intended in that pack.
    // The same seed always rebuilds exactly the same room.
    generateMultiplayerRoom: (room: Room, seed: number): void =>
    {
        const rand = new RandomNumberGenerator(seed);
        const {texturePackPath, palettes} = RoomGenerationPaletteMap.pickTexturePack(rand);
        room.texturePackPath = texturePackPath;

        const grid = new RoomGenerationVoxelGrid();
        const regions = layOutRegions(grid, palettes, rand);
        grid.generate(room.voxelGrid);

        // Laying out the floor plan raises the room's entire boundary, the entrance cell
        // included, so the doorway has to be re-opened once the plan is on the grid.
        RoomGenerationHelperUtil.carveMultiplayerEntrance(room.voxelGrid.voxels);

        for (const region of regions)
            RoomGenerationDecorUtil.addProps(room.voxelGrid, region, [ENTRANCE_CLEARANCE], rand);

        RoomGenerationDecorUtil.hangCanvases(room.voxelGrid, room.objectGroup,
            rand.randomInt(MIN_CANVASES, MAX_CANVASES), [ENTRANCE_CLEARANCE], rand);
    },
}

function layOutRegions(grid: RoomGenerationVoxelGrid, palettes: RoomGenerationPalette[],
    rand: RandomNumberGenerator): RoomGenerationRegion[]
{
    // The band of floor in front of the entrance is always kept as one undivided hall, so that
    // what an arriving player sees is a room rather than the back of a wall.
    const hallDepth = rand.randomInt(MIN_HALL_DEPTH, MAX_HALL_DEPTH);
    const hall: RoomGenerationRect = {
        rowStart: NUM_VOXEL_ROWS - 1 - hallDepth, colStart: 1,
        numRows: hallDepth, numCols: NUM_VOXEL_COLS - 2,
    };
    const hallWall: RoomGenerationRect = {
        rowStart: hall.rowStart - 1, colStart: 1, numRows: 1, numCols: NUM_VOXEL_COLS - 2,
    };

    // Everything deeper into the room than the hall is cut up into rooms of its own.
    const {rects, wallLines} = RoomGenerationLayoutUtil.splitIntoRects(
        {rowStart: 1, colStart: 1, numRows: hallWall.rowStart - 1, numCols: NUM_VOXEL_COLS - 2},
        MIN_REGION_SIZE, rand.randomInt(MIN_SPLIT_DEPTH, MAX_SPLIT_DEPTH + 1), rand);

    const regions: RoomGenerationRegion[] = [{rect: hall, palette: palettes[0]}];
    for (let i = 0; i < rects.length; ++i)
        regions.push({rect: rects[i], palette: palettes[(i + 1) % palettes.length]});

    // Carving the regions out of the generation grid (which starts out solid) is what leaves
    // the walls behind: every cell that no region claimed simply stays solid.
    for (const region of regions)
    {
        grid.createRegion(region.rect.rowStart, region.rect.colStart,
            region.rect.numRows, region.rect.numCols,
            region.palette.floorTextureIndex, region.palette.ceilingTextureIndex,
            region.palette.wallTextureIndex);
    }

    // Opening up every wall the cuts left behind is what makes the whole room walkable.
    RoomGenerationLayoutUtil.carveDoorways(grid, hallWall, regions, rand);
    for (const wallLine of wallLines)
        RoomGenerationLayoutUtil.carveDoorways(grid, wallLine, regions, rand);

    return regions;
}

export default ProceduralRoomGenerationUtil;
