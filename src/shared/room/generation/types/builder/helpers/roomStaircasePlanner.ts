import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import { COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER } from "../../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../../maps/roomVolumeConstructorMap";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";
import RoomAreaAllocator from "./roomAreaAllocator";

//------------------------------------------------------------------------
// Gives some of a room's areas a second storey of their own, and the
// flight of steps that makes one somewhere a player can walk to rather
// than only see.
//
// A second storey is the same footprint again, over the slab dividing the
// room's height. Standing one directly over the other is what makes the
// climb between them a question about a single footprint, and the upper
// storey inherits the separation the area below it was grown to keep, so
// it never crowds its neighbours either.
//
// A storey is raised only where a flight up to it can actually be built.
// A floor nobody can climb to is a floor nobody has, so an area too small
// to hold a flight simply keeps its ceiling, and a room whose areas are
// all too small stays a single storey throughout.
//------------------------------------------------------------------------

// How far a flight climbs, and how many cells it takes to do it: one cell per collision layer, each
// step standing a layer taller than the one before it. That is a stride the player can climb;
// anything taller is a wall to him. The run needs one cell more than it has steps, for the landing
// the climb arrives on.
const RISE_IN_LAYERS = STOREY_FLOOR_COLLISION_LAYER + 1;
const RUN_IN_CELLS = RISE_IN_LAYERS + 1;
const WIDTH_IN_CELLS = 3; // wide enough to walk up rather than balance along

// How far from a flight the room's block work has to stay. A flight is walked onto from the floor
// beside it and stepped off onto the floor beyond it, so a prop standing against either is
// something to squeeze past on stairs - which is exactly where a player has least room to give.
const CLEARANCE = 1;

// One flight of steps as a plan: the shaft it climbs through, and the steps standing in it.
interface Staircase
{
    stairwell: RoomVolume;
    steps: RoomVolume[];
}

export default class RoomStaircasePlanner
{
    // The smallest area a flight fits in, for a room that wants to ask for one of these before it
    // scatters the rest of its areas. A flight is kept a cell clear of its area's edges on every
    // side (see planStaircase), so an area has to be that much bigger than the flight itself.
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

    // `atLeastOne` is for a room that would not be itself as a single storey - a hub is a
    // multi-storey lounge, and one that came out flat because the draw went that way is a worse
    // room rather than a varied one. While nothing has been raised yet it skips the draw entirely,
    // so the first area that can hold a flight gets a storey; from then on the draw decides as
    // usual.
    raiseSecondStoreys(chance: number, atLeastOne: boolean): void
    {
        const stairwells = this.volumesByType[RoomVolumeTypeEnumMap.Stairwell];
        const steps = this.volumesByType[RoomVolumeTypeEnumMap.Step];

        // Over a copy, since the storeys raised here are areas of the room like any other and go
        // into the same list.
        for (const area of this.volumesByType[RoomVolumeTypeEnumMap.Area].slice())
        {
            if (area.collisionLayerMax >= STOREY_FLOOR_COLLISION_LAYER)
                continue; // already reaches the storey above, or is the storey above
            const forced = atLeastOne && stairwells.length == 0;
            if (!forced && this.rand.randomFloat(0, 1) >= chance)
                continue;

            const upper = RoomVolumeConstructorMap["SecondStorey"](
                area.rowMin, area.rowMax, area.colMin, area.colMax, area.palette);

            // Whichever way round the draw asks for, falling back to the other: an area long in one
            // direction and narrow in the other holds a flight perfectly well, just not the way
            // round it was first asked for.
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

    // A flight the given way round, unless it would stand somewhere the room has promised to keep
    // clear. The floor in front of the entrance is the case that matters: a flight rising across it
    // would put a wall of steps between an arriving player and the room, in the one stretch of it
    // nothing is allowed to block.
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

// One flight of steps climbing from an area's floor to the floor of the storey standing over it.
//
// The stairwell is carved like any other volume, which takes the dividing slab out over the run:
// that is what gives a player climbing the room's height above him instead of the underside of the
// floor he is climbing towards. The steps are then the cells of that run stood back up, each one a
// layer taller than the last. The cell past the top of the run is deliberately left out of the
// stairwell, so the slab there stays whole and becomes the landing the climb arrives on.
//
// Returns undefined where the area is too small to hold one this way round, which leaves the
// caller to try the other.
function planStaircase(lower: RoomVolume, upper: RoomVolume,
    alongRows: boolean): Staircase | undefined
{
    // The flight is kept off the area's edges, which leaves a ring of floor running all the way
    // around it. That ring is not decoration: a passage is cut through the wall wherever the layout
    // happens to want one, and a flight standing against that wall would leave the player walking
    // through the opening straight into the side of the steps - somewhere too high to climb and
    // with no way around. With the ring there, every opening lands on floor whatever else the area
    // ended up holding.
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
        // The bottom cell of the run is the area's own floor with nothing standing on it, so the
        // player walks onto the flight rather than up into it.
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
