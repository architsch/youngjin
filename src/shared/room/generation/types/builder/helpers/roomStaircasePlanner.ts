import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import { COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER } from "../../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";
import RoomAreaAllocator from "./roomAreaAllocator";

// Adds second storeys (the same footprint over the dividing slab) only where a climbable flight of
// steps fits; otherwise areas keep their ceiling.

// A flight rises one layer per cell (a climbable stride); the run needs one extra cell for the landing.
const RISE_IN_LAYERS = STOREY_FLOOR_COLLISION_LAYER + 1;
const RUN_IN_CELLS = RISE_IN_LAYERS + 1;
const WIDTH_IN_CELLS = 3; // wide enough to walk up rather than balance along

// Block work must stay this far from a flight's approach and exit.
const CLEARANCE = 1;

// One flight of steps as a plan: the shaft it climbs through, and the steps standing in it.
interface Staircase
{
    stairwell: RoomVolume;
    steps: RoomVolume[];
}

export default class RoomStaircasePlanner
{
    // Smallest area that fits a flight plus the one-cell clearance ring (see planStaircase).
    static readonly MIN_AREA_RUN = RUN_IN_CELLS + 2;
    static readonly MIN_AREA_WIDTH = WIDTH_IN_CELLS + 2;

    private rand: RandomNumberGenerator;
    private volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]};
    private areas: RoomAreaAllocator;

    constructor(rand: RandomNumberGenerator,
        volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]},
        areas: RoomAreaAllocator)
    {
        this.rand = rand;
        this.volumesByType = volumesByType;
        this.areas = areas;
    }

    // atLeastOne: for rooms that must have a second storey; the first eligible area skips the random draw.
    raiseSecondStoreys(chance: number, atLeastOne: boolean): void
    {
        const stairwells = this.volumesByType[RoomVolumeTypeEnumMap.Stairwell];
        const steps = this.volumesByType[RoomVolumeTypeEnumMap.Step];

        // Iterates a copy, since raised storeys are added to the same list.
        for (const area of this.volumesByType[RoomVolumeTypeEnumMap.Area].slice())
        {
            if (area.collisionLayerMax >= STOREY_FLOOR_COLLISION_LAYER)
                continue; // already reaches the storey above, or is the storey above
            const forced = atLeastOne && stairwells.length == 0;
            if (!forced && this.rand.randomFloat(0, 1) >= chance)
                continue;

            const upper = RoomVolumeConstructorMap["SecondStorey"](
                area.rowMin, area.rowMax, area.colMin, area.colMax, area.palette);

            // Try the drawn orientation, then the other.
            const alongRows = this.rand.randomInt(0, 2) == 0;
            const staircase = this.planStaircaseClearOfReservations(area, upper, alongRows)
                ?? this.planStaircaseClearOfReservations(area, upper, !alongRows);
            if (!staircase)
                continue;
            if (!this.areas.add(upper))
                continue; // no room for a storey here after all

            stairwells.push(staircase.stairwell);
            for (const step of staircase.steps)
                steps.push(step);

            // The run, and a block of floor either side of it, are kept clear of block work.
            this.volumesByType[RoomVolumeTypeEnumMap.Reserved].push(
                RoomVolumeUtil.getExpandedVolume(staircase.stairwell, CLEARANCE));
        }
    }

    //--------------------------------------------------------------------------------------------

    // Rejects flights crossing keep-clear stretches (e.g. the floor in front of the entrance).
    private planStaircaseClearOfReservations(lower: RoomVolume, upper: RoomVolume,
        alongRows: boolean): Staircase | undefined
    {
        const staircase = planStaircase(lower, upper, alongRows);
        if (!staircase)
            return undefined;
        const blocked = this.volumesByType[RoomVolumeTypeEnumMap.Reserved].some(
            reserved => RoomVolumeUtil.volumesIntersect(reserved, staircase.stairwell));
        return blocked ? undefined : staircase;
    }
}

// One flight from an area's floor to the storey above. The stairwell is carved (removing the slab over
// the run), then the steps are refilled one layer higher per cell. The cell past the top stays uncarved
// as the landing. Returns undefined if it doesn't fit this orientation.
function planStaircase(lower: RoomVolume, upper: RoomVolume,
    alongRows: boolean): Staircase | undefined
{
    // Inset from the area's edges, leaving a ring of floor so any passage opens onto floor rather than
    // the side of the steps.
    const region = RoomVolumeUtil.getExpandedVolume(lower, -1);
    const runSpan = alongRows ? region.rowMax - region.rowMin + 1 : region.colMax - region.colMin + 1;
    const widthSpan = alongRows ? region.colMax - region.colMin + 1 : region.rowMax - region.rowMin + 1;
    if (runSpan < RUN_IN_CELLS || widthSpan < WIDTH_IN_CELLS)
        return undefined;

    const runStart = alongRows ? region.rowMin : region.colMin;
    const widthStart = alongRows ? region.colMin : region.rowMin;
    const widthEnd = widthStart + WIDTH_IN_CELLS - 1;
    const runEnd = runStart + RISE_IN_LAYERS - 1; // the landing sits one cell beyond this

    const steps: RoomVolume[] = [];
    for (let i = 0; i < RISE_IN_LAYERS; ++i)
    {
        // The first run cell is bare floor, so the flight is walked onto.
        const topLayer = COLLISION_LAYER_MIN + i - 1;
        if (topLayer < COLLISION_LAYER_MIN)
            continue;
        steps.push(alongRows
            ? new RoomVolume(runStart + i, runStart + i, widthStart, widthEnd,
                COLLISION_LAYER_MIN, topLayer, lower.palette)
            : new RoomVolume(widthStart, widthEnd, runStart + i, runStart + i,
                COLLISION_LAYER_MIN, topLayer, lower.palette));
    }

    const stairwell = alongRows
        ? new RoomVolume(runStart, runEnd, widthStart, widthEnd,
            COLLISION_LAYER_MIN, upper.collisionLayerMax, lower.palette)
        : new RoomVolume(widthStart, widthEnd, runStart, runEnd,
            COLLISION_LAYER_MIN, upper.collisionLayerMax, lower.palette);

    return {stairwell, steps};
}
