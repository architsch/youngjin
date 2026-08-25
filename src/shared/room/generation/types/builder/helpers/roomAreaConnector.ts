import { NUM_COLLISION_LAYERS_PER_STOREY } from "../../../../../system/sharedConstants";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";

//------------------------------------------------------------------------
// Joins the areas of a room up until every one of them is reachable from
// every other, by cutting passages through the walls between them.
//
// A room a player cannot walk all of is a room he does not have, so this
// is the property the whole layout exists to satisfy - and it is settled
// here, on the plan, where it is cheap to check, rather than left to be
// discovered by somebody walking around a room that turned out to be
// sealed off.
//------------------------------------------------------------------------

// A passage is cut the full height of the storey it joins, so that it stands on the floor of both
// areas rather than a block above it - a doorway a player has to step up into reads as a mistake.
const MAX_PASSAGE_WIDTH = 3;
const MAX_PASSAGE_HEIGHT = NUM_COLLISION_LAYERS_PER_STOREY;

export default class RoomAreaConnector
{
    private volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]};

    constructor(volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]})
    {
        this.volumesByType = volumesByType;
    }

    connect(): void
    {
        const areas = this.volumesByType[RoomVolumeTypeEnumMap.Area];
        const parents = areas.map((_, index) => index);

        // A flight of steps is already a way between the two areas its stairwell climbs through, so
        // those areas start out connected. There is nothing to record for that: a stairwell reaches
        // from the floor of the area below into the area above, so the pair it joins is the pair it
        // stands in.
        for (const stairwell of this.volumesByType[RoomVolumeTypeEnumMap.Stairwell])
        {
            const climbed: number[] = [];
            for (let i = 0; i < areas.length; ++i)
            {
                if (RoomVolumeUtil.volumesIntersect(stairwell, areas[i]))
                    climbed.push(i);
            }
            for (let i = 1; i < climbed.length; ++i)
                parents[findRoot(parents, climbed[0])] = findRoot(parents, climbed[i]);
        }

        // The near-adjacent pairs first: areas with exactly one block of wall between them, which
        // is the opening the layout was grown to produce.
        this.joinPairs(parents, (a, b) => RoomVolumeUtil.volumesIntersect(
            RoomVolumeUtil.getExpandedVolume(a, 1), RoomVolumeUtil.getExpandedVolume(b, 1)));

        // Then whatever is still on its own, joined by a longer passage cut through the mass
        // between them. Growth can easily leave an area with no near neighbour at all.
        this.joinPairs(parents, () => true);

        // And finally the areas a straight passage cannot reach at all: one lying diagonally from
        // everything else shares neither a row nor a column with it, and a passage is a straight
        // run. Those are joined by a corridor that turns a corner, which can reach anywhere.
        this.joinRemainderWithCorridors(parents);

        const rootCount = areas.filter((_, index) => findRoot(parents, index) == index).length;
        if (rootCount > 1)
        {
            console.error(`RoomAreaConnector::connect :: ` +
                `The room came out in ${rootCount} separate pieces.`);
        }
    }

    //--------------------------------------------------------------------------------------------

    // Takes every pair the given test admits and cuts a passage through the wall between them,
    // keeping the ones that bring two separate parts of the room together. Pairs that were already
    // connected are passed over, so the room ends up with the openings it needs rather than a wall
    // with a hole in every stretch of it.
    private joinPairs(parents: number[],
        pairIsWorthTrying: (a: RoomVolume, b: RoomVolume) => boolean): void
    {
        const areas = this.volumesByType[RoomVolumeTypeEnumMap.Area];
        for (let i = 0; i < areas.length; ++i)
        {
            for (let j = i + 1; j < areas.length; ++j)
            {
                if (findRoot(parents, i) == findRoot(parents, j))
                    continue;

                const a = areas[i];
                const b = areas[j];
                if (!pairIsWorthTrying(a, b) || !areasShareAFloor(a, b))
                    continue;

                const passage = RoomVolumeUtil.makePassageBetweenVolumes(a, b,
                    MAX_PASSAGE_WIDTH, MAX_PASSAGE_HEIGHT);
                if (passage == null)
                    continue;

                passage.palette = a.palette;
                this.volumesByType[RoomVolumeTypeEnumMap.Passage].push(passage);
                parents[findRoot(parents, i)] = findRoot(parents, j);
            }
        }
    }

    // Joins whatever the straight passages could not reach, with a corridor that turns a corner:
    // one run along the rows and another along the columns, meeting at the corner between them. A
    // corridor is cut at a height the two areas share, and simply opens whatever it crosses on the
    // way - a corridor running through an area it passes is a wider opening, not a fault.
    private joinRemainderWithCorridors(parents: number[]): void
    {
        const areas = this.volumesByType[RoomVolumeTypeEnumMap.Area];
        for (let i = 0; i < areas.length; ++i)
        {
            for (let j = i + 1; j < areas.length; ++j)
            {
                if (findRoot(parents, i) == findRoot(parents, j))
                    continue;

                const a = areas[i];
                const b = areas[j];
                if (!areasShareAFloor(a, b))
                    continue;
                const layerMin = a.collisionLayerMin;
                const layerMax = Math.min(a.collisionLayerMax, b.collisionLayerMax);

                const rowA = Math.floor(0.5 * (a.rowMin + a.rowMax));
                const colA = Math.floor(0.5 * (a.colMin + a.colMax));
                const rowB = Math.floor(0.5 * (b.rowMin + b.rowMax));
                const colB = Math.floor(0.5 * (b.colMin + b.colMax));

                this.volumesByType[RoomVolumeTypeEnumMap.Passage].push(
                    new RoomVolume(Math.min(rowA, rowB), Math.max(rowA, rowB), colA, colA,
                        layerMin, layerMax, a.palette),
                    new RoomVolume(rowB, rowB, Math.min(colA, colB), Math.max(colA, colB),
                        layerMin, layerMax, b.palette));
                parents[findRoot(parents, i)] = findRoot(parents, j);
            }
        }
    }
}

// Whether a player can walk from one area straight into the other, which is what a passage between
// them has to be able to promise. Two areas standing on the same floor can be joined by an opening
// in the wall between them; two on different floors cannot, however much of their height they
// share. A gallery cut through into the open hall beside it is the case worth naming: the two do
// share a height, and an opening there leads to a drop rather than to the hall.
function areasShareAFloor(a: RoomVolume, b: RoomVolume): boolean
{
    return a.collisionLayerMin == b.collisionLayerMin;
}

function findRoot(parents: number[], index: number): number
{
    while (parents[index] != index)
    {
        parents[index] = parents[parents[index]];
        index = parents[index];
    }
    return index;
}
