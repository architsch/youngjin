import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import Voxel from "../../../../../voxel/types/voxel";
import VoxelQueryUtil from "../../../../../voxel/util/voxelQueryUtil";
import RoomVolumeUtil from "../../../util/roomVolumeUtil";
import RoomPalette from "../../roomPalette";
import RoomVolume from "../../roomVolume";
import { RoomVolumeType, RoomVolumeTypeEnumMap } from "../../roomVolumeType";

//------------------------------------------------------------------------
// Stands decorative block work on the floor of the areas a room is made
// of, in the palette each area is finished in.
//
// This works off the built room rather than off the plan, and has to:
// whether there is anything at a given place to stand something on is a
// question only the carved room can answer. An area over a stairwell, or
// over somewhere the storey below stands open, has no floor there at all.
//------------------------------------------------------------------------

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

    place(voxels: Voxel[], chancePerCell: number, maxStackHeight: number): void
    {
        for (const area of this.volumesByType[RoomVolumeTypeEnumMap.Area])
        {
            const palette = area.palette;
            if (!palette)
                continue;

            // Props are furniture in the space a player walks around them in, so they are kept off
            // the edges of the area - a block against a wall is part of the wall to anyone looking.
            const inner = RoomVolumeUtil.getExpandedVolume(area, -1);
            if (inner.rowMin > inner.rowMax || inner.colMin > inner.colMax)
                continue;

            // A prop wears its area's prop texture on every side, which is what a palette of that
            // one texture says. The block work is then finished exactly as the room around it is.
            const propPalette = new RoomPalette(palette.prop, palette.prop, palette.prop, palette.prop);

            for (let row = inner.rowMin; row <= inner.rowMax; ++row)
            {
                for (let col = inner.colMin; col <= inner.colMax; ++col)
                {
                    if (this.rand.randomFloat(0, 1) >= chancePerCell)
                        continue;

                    // Nothing hangs in mid-air: the block at the foot of the stack has to have the
                    // area's own floor under it.
                    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
                    if (!voxel || !VoxelQueryUtil.isVoxelCollisionLayerOccupied(
                        voxel, area.collisionLayerMin - 1))
                    {
                        continue;
                    }

                    // Leave headroom under the area's own ceiling, so that a stack is furniture in
                    // the room rather than a pillar holding it up.
                    const height = this.rand.randomInt(1, maxStackHeight + 1);
                    const stack = new RoomVolume(row, row, col, col, area.collisionLayerMin,
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

    // Nothing is built on a stretch the room has promised to keep clear: the floor the entrance
    // opens onto, and the approach to every flight of steps.
    private standsOnReservedGround(stack: RoomVolume): boolean
    {
        return this.volumesByType[RoomVolumeTypeEnumMap.Reserved].some(
            reserved => RoomVolumeUtil.volumesIntersect(reserved, stack));
    }
}
