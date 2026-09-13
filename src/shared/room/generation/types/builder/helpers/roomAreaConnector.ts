import { NUM_COLLISION_LAYERS_PER_STOREY } from "../../../../../system/sharedConstants";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";

// Cuts passages until every area is reachable (checked on the plan, before carving).

// Passages span the full storey height, so they're level with both floors.
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

        // Areas joined by a stairwell start out connected.
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

        // First: pairs one wall block apart.
        this.joinPairs(parents, (a, b) => RoomVolumeUtil.volumesIntersect(
            RoomVolumeUtil.getExpandedVolume(a, 1), RoomVolumeUtil.getExpandedVolume(b, 1)));

        // Then: isolated areas, via longer passages through the mass.
        this.joinPairs(parents, () => true);

        // Finally: diagonal areas no straight passage can reach, via L-shaped corridors.
        this.joinRemainderWithCorridors(parents);

        const rootCount = areas.filter((_, index) => findRoot(parents, index) == index).length;
        if (rootCount > 1)
        {
            console.error(`RoomAreaConnector::connect :: ` +
                `The room came out in ${rootCount} separate pieces.`);
        }
    }

    //--------------------------------------------------------------------------------------------

    // Cuts passages for admitted pairs that join separate components (already-connected pairs are skipped).
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

    // L-shaped corridors for what remains, cut at a shared height; crossing other areas is fine.
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

// Only areas on the same floor can be joined (an opening to a different floor leads to a drop).
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
