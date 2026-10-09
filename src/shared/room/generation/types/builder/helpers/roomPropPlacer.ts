import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import { GENERATED_WALL_THICKNESS } from "../../../../../system/sharedConstants";
import Voxel from "../../../../../voxel/types/voxel";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomPalette from "../../roomPalette";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";

// Places decorative block stacks on area floors in each area's palette. Works on the carved room, since
// only it knows where there is floor (areas over stairwells or open storeys have none).

export default class RoomPropPlacer
{
    private rand: RandomNumberGenerator;
    private volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]};

    constructor(rand: RandomNumberGenerator,
        volumesByType: {[roomVolumeType: RoomVolumeType]: RoomVolume[]})
    {
        this.rand = rand;
        this.volumesByType = volumesByType;
    }

    // A stack stands on a spot a wall's thickness square; chancePerSpot is each spot's chance of holding one.
    place(voxels: Voxel[], chancePerSpot: number, maxStackHeight: number): void
    {
        for (const area of this.volumesByType[RoomVolumeTypeEnumMap.Area])
        {
            const palette = area.palette;
            if (!palette)
                continue;

            // Kept off area edges (a block against a wall reads as wall).
            const inner = RoomVolumeUtil.getExpandedVolume(area, -1);
            if (inner.rowMin > inner.rowMax || inner.colMin > inner.colMax)
                continue;

            // The prop texture on all sides.
            const propPalette = new RoomPalette(palette.prop, palette.prop, palette.prop, palette.prop);

            for (let row = inner.rowMin; row <= inner.rowMax; row += GENERATED_WALL_THICKNESS)
            {
                for (let col = inner.colMin; col <= inner.colMax; col += GENERATED_WALL_THICKNESS)
                {
                    if (this.rand.randomFloat(0, 1) >= chancePerSpot)
                        continue;

                    const rowMax = row + GENERATED_WALL_THICKNESS - 1;
                    const colMax = col + GENERATED_WALL_THICKNESS - 1;

                    // Requires the area's own floor under the stack (nothing floats).
                    const floorLayer = area.collisionLayerMin - 1;
                    if (!RoomVolumeUtil.volumeIsSolid(voxels,
                        new RoomVolume(row, rowMax, col, colMax, floorLayer, floorLayer)))
                    {
                        continue;
                    }

                    // Leave headroom so a stack isn't a pillar.
                    const height = this.rand.randomInt(1, maxStackHeight + 1);
                    const stack = new RoomVolume(row, rowMax, col, colMax, area.collisionLayerMin,
                        Math.min(area.collisionLayerMin + height - 1, area.collisionLayerMax - 1),
                        propPalette);
                    if (stack.collisionLayerMin > stack.collisionLayerMax)
                        continue;
                    if (this.standsOnReservedGround(stack))
                        continue;

                    RoomVolumeUtil.fillVolume(voxels, stack);
                }
            }
        }
    }

    //--------------------------------------------------------------------------------------------

    // Never on keep-clear ground (entrance floor, stair approaches).
    private standsOnReservedGround(stack: RoomVolume): boolean
    {
        return this.volumesByType[RoomVolumeTypeEnumMap.Reserved].some(
            reserved => RoomVolumeUtil.volumesIntersect(reserved, stack));
    }
}
