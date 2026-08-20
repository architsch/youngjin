import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import RoomGenerationPaletteMap from "../maps/roomGenerationPaletteMap";
import Room from "../types/room";
import RoomGenerationPalette from "../types/roomGeneration/roomGenerationPalette";
import RoomGenerationSpace from "../types/roomGeneration/roomGenerationSpace";
import RoomGenerationStaircase from "../types/roomGeneration/roomGenerationStaircase";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationCanvasUtil from "./roomGenerationCanvasUtil";
import RoomGenerationLayoutUtil from "./roomGenerationLayoutUtil";
import RoomGenerationPropsUtil from "./roomGenerationPropsUtil";
import RoomGenerationSpaceUtil from "./roomGenerationSpaceUtil";
import RoomGenerationStairsUtil from "./roomGenerationStairsUtil";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Builds a whole multiplayer room out of the room generation system's parts. This is the recipe
// layer: it decides what a multiplayer room is made of, and leaves the how to the layout, stairs,
// props and canvas utils.
//
// See @docs/geometry/room_generation.md .

const MIN_SPACE_SIZE = 7; // no generated room comes out narrower than this, so every one of them stays walkable
const MIN_SPLIT_DEPTH = 2;
const MAX_SPLIT_DEPTH = 3;
const MIN_HALL_DEPTH = 6;
const MAX_HALL_DEPTH = 9;
const MIN_CANVASES = 16;
const MAX_CANVASES = 33;

// How likely a space is to stand open through both storeys rather than being floored over, and how
// much of the room may be given over to such spaces. A room needs enough floored spaces to be worth
// having an upper storey at all, so this is a minority of them by construction.
const TALL_SPACE_CHANCE = 0.34;
const MAX_TALL_SPACE_RATIO = 0.5;

// How far inside a space that stands open through both storeys the drop begins. The ring of floor
// left around it is the gallery the upper storey looks down from — and, just as importantly, the
// floor the upper storey's doorways open onto, which a space opened up to its very edge would leave
// a player stepping out into thin air through.
const TALL_SPACE_MARGIN = 1;

// How far from a staircase the room's block work has to stay. A flight is walked onto from the
// floor beside it and stepped off onto the floor beyond it, so a prop standing against either is
// something to squeeze past on stairs — which is exactly where a player has least room to give.
const STAIRCASE_CLEARANCE = 1;

// The stretch of floor the entrance opens onto is never built on and never hung with anything, at
// any height. That keeps an arriving player from being boxed in whichever way the rest of the room
// came out, and keeps generated content clear of the cells that room editing protects
// (see @docs/geometry/room_entrance.md).
const ENTRANCE_CLEARANCE: RoomGenerationVolume = {
    ...RoomGenerationVolumeUtil.WHOLE_ROOM,
    rowStart: NUM_VOXEL_ROWS - 6, colStart: MULTI_PLAYER_ENTRANCE_VOXEL_COL - 2,
    numRows: 6, numCols: 5,
};

const ProceduralRoomGenerationUtil =
{
    // Lays out a complete multiplayer room: an open hall behind the entrance, a handful of
    // differently finished rooms beyond it joined by archways, an upper storey over them reached by
    // staircases, decorative block work standing on both storeys, and paintings hung on the walls of
    // each. The room's own texture pack is drawn here too, since every texture the layout picks is a
    // position within one specific pack's atlas and only reads as intended in that pack.
    // The same seed always rebuilds exactly the same room.
    generateMultiplayerRoom: (room: Room, seed: number): void =>
    {
        const rand = new RandomNumberGenerator(seed);
        const {texturePackPath, palettes} = RoomGenerationPaletteMap.pickTexturePack(rand);
        room.texturePackPath = texturePackPath;

        // The plan. The room is settled as a floor plan and the flights that climb out of it, and
        // only then as the spaces it is actually made of — since how many storeys a room has at all
        // turns on whether anything in it can be climbed.
        const {areas, wallLines} = layOutAreas(palettes, rand);
        const staircases = RoomGenerationStairsUtil.planStaircases(
            areas, [ENTRANCE_CLEARANCE], RoomGenerationVolumeUtil.GROUND_STOREY, rand);

        // A room nothing can climb is built as one tall space throughout, rather than being given
        // an upper floor that nobody can reach.
        const storeys = (staircases.length > 0)
            ? [RoomGenerationVolumeUtil.GROUND_STOREY, RoomGenerationVolumeUtil.UPPER_STOREY]
            : [RoomGenerationVolumeUtil.WHOLE_ROOM];

        // Every area of the floor plan becomes one space per storey, and so does every doorway
        // through the walls between them — a wall divides the room at every height alike, and so
        // does an opening cut through it.
        const rooms = getSpacesPerStorey(areas, storeys);
        const spaces = [
            ...rooms,
            ...getSpacesPerStorey(RoomGenerationLayoutUtil.planDoorways(areas, wallLines, rand), storeys),
            ...planTallSpaces(areas, staircases, rand),
            ...planStairwells(staircases),
            // The way in, which is a cavity for passage like any doorway — the room's boundary is
            // mass like any other wall, so without this the room has none.
            {volume: RoomGenerationVolumeUtil.MULTI_PLAYER_ENTRANCE, palette: areas[0].palette},
        ];

        // The building.
        RoomGenerationSpaceUtil.build(room.voxelGrid, spaces);
        RoomGenerationStairsUtil.buildStaircases(room.voxelGrid, staircases,
            RoomGenerationVolumeUtil.GROUND_STOREY);

        // The furnishing, which works off the built room rather than off the plan — above all
        // because whether there is anything at a given place to stand something on is a question
        // only the finished room can answer.
        const staircaseVolumes = staircases.map(staircase => staircase.volume);
        const propKeepClearVolumes = [ENTRANCE_CLEARANCE, ...staircaseVolumes.map(
            volume => RoomGenerationVolumeUtil.expand(volume, STAIRCASE_CLEARANCE))];

        for (const space of rooms)
            RoomGenerationPropsUtil.addProps(room.voxelGrid, space, propKeepClearVolumes, rand);

        RoomGenerationCanvasUtil.hangCanvases(room.voxelGrid, room.objectGroup,
            rand.randomInt(MIN_CANVASES, MAX_CANVASES), [ENTRANCE_CLEARANCE, ...staircaseVolumes],
            storeys, rand);
    },
}

// Cuts the room into the areas its floor plan is made of. These stand the room's full height: what
// a room does with them at each of its storeys is settled afterwards.
function layOutAreas(palettes: RoomGenerationPalette[], rand: RandomNumberGenerator):
    {areas: RoomGenerationSpace[], wallLines: RoomGenerationVolume[]}
{
    // The band of floor in front of the entrance is always kept as one undivided hall, so that
    // what an arriving player sees is a room rather than the back of a wall.
    const hallDepth = rand.randomInt(MIN_HALL_DEPTH, MAX_HALL_DEPTH);
    const hall: RoomGenerationVolume = {
        ...RoomGenerationVolumeUtil.WHOLE_ROOM,
        rowStart: NUM_VOXEL_ROWS - 1 - hallDepth, colStart: 1,
        numRows: hallDepth, numCols: NUM_VOXEL_COLS - 2,
    };
    const hallWall: RoomGenerationVolume = {
        ...RoomGenerationVolumeUtil.WHOLE_ROOM,
        rowStart: hall.rowStart - 1, colStart: 1, numRows: 1, numCols: NUM_VOXEL_COLS - 2,
    };

    // Everything deeper into the room than the hall is cut up into rooms of its own.
    const {volumes, wallLines} = RoomGenerationLayoutUtil.splitIntoVolumes(
        {...RoomGenerationVolumeUtil.WHOLE_ROOM,
            rowStart: 1, colStart: 1, numRows: hallWall.rowStart - 1, numCols: NUM_VOXEL_COLS - 2},
        MIN_SPACE_SIZE, rand.randomInt(MIN_SPLIT_DEPTH, MAX_SPLIT_DEPTH + 1), rand);

    const areas: RoomGenerationSpace[] = [{volume: hall, palette: palettes[0]}];
    for (let i = 0; i < volumes.length; ++i)
        areas.push({volume: volumes[i], palette: palettes[(i + 1) % palettes.length]});

    return {areas, wallLines: [hallWall, ...wallLines]};
}

// The same footprint on each of the room's storeys, for every area of its floor plan.
function getSpacesPerStorey(areas: RoomGenerationSpace[],
    storeys: RoomGenerationVolume[]): RoomGenerationSpace[]
{
    const spaces: RoomGenerationSpace[] = [];
    for (const area of areas)
    {
        for (const storey of storeys)
        {
            spaces.push({volume: RoomGenerationVolumeUtil.intersect(area.volume, storey),
                palette: area.palette});
        }
    }
    return spaces;
}

// Opens some of the room's areas from their own floor to the room's ceiling, so that the room is
// not uniformly two storeys of the same height. Where one of these stands, the upper storey looks
// down into it over the gallery running around its edge.
//
// An area holding a staircase keeps its floor whatever the seed says, since the whole point of
// those stairs is to arrive somewhere. And a room with no staircase at all is already one tall
// space throughout, so there is nothing here left to open.
function planTallSpaces(areas: RoomGenerationSpace[], staircases: RoomGenerationStaircase[],
    rand: RandomNumberGenerator): RoomGenerationSpace[]
{
    if (staircases.length == 0)
        return [];

    const staircaseVolumes = staircases.map(staircase => staircase.volume);
    const maxTallSpaces = Math.floor(areas.length * MAX_TALL_SPACE_RATIO);
    const tallSpaces: RoomGenerationSpace[] = [];

    for (const area of areas)
    {
        if (tallSpaces.length >= maxTallSpaces)
            break;
        if (RoomGenerationVolumeUtil.overlapsAny(staircaseVolumes, area.volume))
            continue;
        if (rand.randomFloat(0, 1) >= TALL_SPACE_CHANCE)
            continue;

        const opening = RoomGenerationVolumeUtil.inset(area.volume, TALL_SPACE_MARGIN);
        if (RoomGenerationVolumeUtil.isEmpty(opening))
            continue; // Too small to open up without taking the gallery around it with it.

        tallSpaces.push({volume: opening, palette: area.palette});
    }
    return tallSpaces;
}

function planStairwells(staircases: RoomGenerationStaircase[]): RoomGenerationSpace[]
{
    const stairwells: RoomGenerationSpace[] = [];
    for (const staircase of staircases)
    {
        const volumes = RoomGenerationStairsUtil.getStairwellVolumes(staircase,
            RoomGenerationVolumeUtil.GROUND_STOREY);
        for (const volume of volumes)
            stairwells.push({volume, palette: staircase.palette});
    }
    return stairwells;
}

export default ProceduralRoomGenerationUtil;
