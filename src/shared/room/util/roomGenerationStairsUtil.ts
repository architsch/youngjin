import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import VoxelGrid from "../../voxel/types/voxelGrid";
import RoomGenerationSpace from "../types/roomGeneration/roomGenerationSpace";
import RoomGenerationStaircase from "../types/roomGeneration/roomGenerationStaircase";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Puts the stairs into a two-storey room: where they stand, what has to be left open around them,
// and what they are made of.
//
// A staircase is settled in two parts, because a room is built in two parts. Where it stands has to
// be decided while the room is still a plan, since the stairwell is one of the spaces the room is
// hollowed out to — steps climbing into the underside of a storey floor lead nowhere, and a player
// on them would have his head in it well before he reached the top. The steps themselves are then
// built into the finished grid, alongside the room's other block work.
//
// See @docs/geometry/room_generation.md .

// How wide each of a flight's two lanes is, in cells. A lane one cell across is a ledge the player
// has to line himself up on before every stride, and slips off the side of whenever he does not;
// widening it turns the same flight into stairs he can simply walk up.
const LANE_WIDTH = 2;

// How far inside a space a staircase must stand. Its edge cells are where the doorways open, so a
// staircase reaching them would be climbed into rather than walked up to — and its landing would
// leave a player stepping straight off the top of it into a doorway.
const SPACE_MARGIN = 1;

// How many placements are tried before a space is given up on. Each is a position and a turn drawn
// from the seed rather than a sweep of the space, so that a room's staircases are no more alike
// from one seed to the next than the rest of it is.
const MAX_PLACEMENT_ATTEMPTS = 24;

const MIN_STAIRCASES = 1;
const MAX_STAIRCASES = 3;

const RoomGenerationStairsUtil =
{
    // Settles where a room's staircases stand, given the storey they climb out of and the spaces
    // they may stand in. This is pure geometry: a staircase placed here is a claim on a patch of
    // floor, and nothing of it exists until the room is built.
    //
    // A room with no way upstairs is a room half of which nobody can reach, so this keeps trying
    // spaces until one takes a staircase. A room whose spaces are all too small to hold one is
    // reported by an empty result, which the caller is expected to treat as the room having no
    // upper storey at all rather than as an unreachable one.
    planStaircases: (spaces: RoomGenerationSpace[], keepClearVolumes: RoomGenerationVolume[],
        storey: RoomGenerationVolume, rand: RandomNumberGenerator): RoomGenerationStaircase[] =>
    {
        const runLength = getRunLength(storey);
        const staircases: RoomGenerationStaircase[] = [];
        const maxStaircases = rand.randomInt(MIN_STAIRCASES, MAX_STAIRCASES + 1);

        for (const space of rand.shuffle(spaces.slice()))
        {
            if (staircases.length >= maxStaircases)
                break;
            const staircase = planStaircaseIn(space, keepClearVolumes, staircases, runLength, rand);
            if (staircase != undefined)
                staircases.push(staircase);
        }
        return staircases;
    },

    // The stairwell: everything the stairs pass through, which stands open from the room's floor to
    // its ceiling so that a player climbing them has the room's full height over his head all the
    // way up. Only the landing is left out of it, that being the floor he arrives on — so it keeps
    // the storey floor the rest of the flight is opened up through.
    getStairwellVolumes: (staircase: RoomGenerationStaircase,
        storey: RoomGenerationVolume): RoomGenerationVolume[] =>
    {
        const runLength = getRunLength(storey);
        return [
            getFootprintVolume(staircase, 0, 0, LANE_WIDTH, runLength, runLength),
            getFootprintVolume(staircase, LANE_WIDTH, 1, LANE_WIDTH, runLength - 1, runLength),
        ];
    },

    // Builds the steps themselves into the finished grid. Each step is a tread the full width of its
    // lane, standing one layer taller than the step before it, so that every one of them is a stride
    // a player can climb and the last of them stands level with the storey floor it delivers him onto.
    buildStaircases: (voxelGrid: VoxelGrid, staircases: RoomGenerationStaircase[],
        storey: RoomGenerationVolume): void =>
    {
        const runLength = getRunLength(storey);
        const numSteps = getNumSteps(storey);

        for (const staircase of staircases)
        {
            const textureIndices = RoomGenerationHelperUtil.getBoxTextureIndices(
                staircase.palette.ceilingTextureIndex, // the underside, where a step overhangs the one below
                staircase.palette.floorTextureIndex, // the tread, which is walked over
                staircase.palette.wallTextureIndex); // the risers, which read as block work rather than as floor

            for (let step = 0; step < numSteps; ++step)
            {
                for (const {row, col} of getStepCells(staircase, step, runLength))
                {
                    RoomGenerationHelperUtil.addWall(voxelGrid.voxels, row, col, textureIndices,
                        storey.collisionLayerStart, storey.collisionLayerStart + step);
                }
            }
        }
    },
}

// How many steps it takes to climb out of a storey: one per layer standing open in it, plus the
// one that stands level with the floor above and delivers the player onto it.
function getNumSteps(storey: RoomGenerationVolume): number
{
    return storey.numCollisionLayers + 1;
}

// How long each of a staircase's two lanes is: enough cells between them for every step, plus the
// landing the topmost step delivers onto.
function getRunLength(storey: RoomGenerationVolume): number
{
    return Math.ceil((getNumSteps(storey) + 1) / 2);
}

// The footprint a flight of the given run length takes up: two lanes side by side across, the run
// itself along.
function getFootprintSize(alongCols: boolean, runLength: number): {numRows: number, numCols: number}
{
    const acrossSize = 2 * LANE_WIDTH;
    return alongCols
        ? {numRows: acrossSize, numCols: runLength}
        : {numRows: runLength, numCols: acrossSize};
}

// Where one box of a footprint lies, given how far across the flight it sits and how far along the
// run. The run is measured from the end the flight starts climbing at, which is what "ascendsForward"
// turns around. It stands the full height of the staircase, the flight being open all the way up.
function getFootprintVolume(staircase: RoomGenerationStaircase, acrossOffset: number,
    alongOffset: number, acrossSize: number, alongSize: number,
    runLength: number): RoomGenerationVolume
{
    const alongStart = staircase.ascendsForward
        ? alongOffset : (runLength - alongOffset - alongSize);
    const {volume} = staircase;

    return staircase.alongCols
        ? {...volume, rowStart: volume.rowStart + acrossOffset, colStart: volume.colStart + alongStart,
            numRows: acrossSize, numCols: alongSize}
        : {...volume, rowStart: volume.rowStart + alongStart, colStart: volume.colStart + acrossOffset,
            numRows: alongSize, numCols: acrossSize};
}

// Where one step of a staircase stands: the full width of its lane, at one place along the run. The
// steps run out along the first lane and back along the second, so a step's place is its distance
// along whichever lane it falls in — counted from the far end for the returning lane, which is what
// makes the two lanes meet at their shared end.
function getStepCells(staircase: RoomGenerationStaircase, step: number,
    runLength: number): {row: number, col: number}[]
{
    const lane = (step < runLength) ? 0 : 1;
    const alongOffset = (step < runLength) ? step : (2 * runLength - 1 - step);
    return RoomGenerationVolumeUtil.getCells(
        getFootprintVolume(staircase, lane * LANE_WIDTH, alongOffset, LANE_WIDTH, 1, runLength));
}

function planStaircaseIn(space: RoomGenerationSpace, keepClearVolumes: RoomGenerationVolume[],
    placed: RoomGenerationStaircase[], runLength: number,
    rand: RandomNumberGenerator): RoomGenerationStaircase | undefined
{
    // Standing the flight inside the space rather than up against its edge is also what keeps the
    // question purely geometric: everything within a space is open floor by construction, so a
    // footprint that fits in there needs nothing asked of the room itself.
    const inner = RoomGenerationVolumeUtil.inset(space.volume, SPACE_MARGIN);
    const placedVolumes = placed.map(staircase => staircase.volume);

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; ++attempt)
    {
        const alongCols = rand.randomInt(0, 2) == 0;
        const {numRows, numCols} = getFootprintSize(alongCols, runLength);
        if (inner.numRows < numRows || inner.numCols < numCols)
            continue;

        // The flight is open through the whole room, however much of it the steps themselves fill.
        const volume: RoomGenerationVolume = {
            ...RoomGenerationVolumeUtil.WHOLE_ROOM,
            rowStart: inner.rowStart + rand.randomInt(0, inner.numRows - numRows + 1),
            colStart: inner.colStart + rand.randomInt(0, inner.numCols - numCols + 1),
            numRows, numCols,
        };
        if (RoomGenerationVolumeUtil.overlapsAny(placedVolumes, volume) ||
            RoomGenerationVolumeUtil.overlapsAny(keepClearVolumes, volume))
        {
            continue;
        }
        return {volume, alongCols, ascendsForward: rand.randomInt(0, 2) == 0, palette: space.palette};
    }
    return undefined;
}

export default RoomGenerationStairsUtil;
