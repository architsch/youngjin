import NumUtil from "../../../math/util/numUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS } from "../../../system/sharedConstants";
import Voxel from "../../../voxel/types/voxel";
import VoxelQuadUpdateUtil from "../../../voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../../voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../voxel/util/voxelUpdateUtil";
import RoomVolume from "../types/roomVolume";
import RoomVolumeRangeIntersections from "../types/roomVolumeRangeIntersections";

// A Voxel is a stack of blocks (row, col, collisionLayer); a RoomVolume is a box of whole blocks.
const RoomVolumeUtil =
{
    volumeContainsBlock(volume: RoomVolume,
        blockRow: number, blockCol: number, blockCollisionLayer: number): boolean
    {
        return blockRow >= volume.rowMin && blockRow <= volume.rowMax &&
            blockCol >= volume.colMin && blockCol <= volume.colMax &&
            blockCollisionLayer >= volume.collisionLayerMin &&
            blockCollisionLayer <= volume.collisionLayerMax;
    },
    volumesIntersect(volume1: RoomVolume, volume2: RoomVolume): boolean
    {
        const rangeIntersections = getVolumeRangeIntersections(volume1, volume2);
        return rangeIntersections.rowRangeIntersection != null &&
            rangeIntersections.colRangeIntersection != null &&
            rangeIntersections.collisionLayerRangeIntersection != null;
    },
    // Returns NULL if there is no intersection.
    getIntersection(volume1: RoomVolume, volume2: RoomVolume): RoomVolume | null
    {
        const rangeIntersections = getVolumeRangeIntersections(volume1, volume2);
        if (rangeIntersections.rowRangeIntersection == null ||
            rangeIntersections.colRangeIntersection == null ||
            rangeIntersections.collisionLayerRangeIntersection == null)
            return null;
        return new RoomVolume(
            rangeIntersections.rowRangeIntersection[0],
            rangeIntersections.rowRangeIntersection[1],
            rangeIntersections.colRangeIntersection[0],
            rangeIntersections.colRangeIntersection[1],
            rangeIntersections.collisionLayerRangeIntersection[0],
            rangeIntersections.collisionLayerRangeIntersection[1]
        );
    },
    // The volume expanded by `amount` on all six sides (negative shrinks). With volumesIntersect:
    // - intersects(expand(a, 1), b): a and b would touch (growth rejects this).
    // - intersects(expand(a, 1), expand(b, 1)) while not touching: exactly one wall block between them
    //   (where passages go).
    // Height expands too, so stacked volumes behave like side-by-side ones.
    getExpandedVolume(volume: RoomVolume, amount: number): RoomVolume
    {
        return new RoomVolume(
            volume.rowMin - amount, volume.rowMax + amount,
            volume.colMin - amount, volume.colMax + amount,
            volume.collisionLayerMin - amount, volume.collisionLayerMax + amount,
            volume.palette);
    },
    volumeContainsVolume(outer: RoomVolume, inner: RoomVolume): boolean
    {
        return inner.rowMin >= outer.rowMin && inner.rowMax <= outer.rowMax &&
            inner.colMin >= outer.colMin && inner.colMax <= outer.colMax &&
            inner.collisionLayerMin >= outer.collisionLayerMin &&
            inner.collisionLayerMax <= outer.collisionLayerMax;
    },
    // Inside `bounds` and not touching any of `others`. `ignore` excludes the volume being grown.
    volumeFitsAmong(volume: RoomVolume, bounds: RoomVolume, others: RoomVolume[],
        ignore?: RoomVolume): boolean
    {
        if (!RoomVolumeUtil.volumeContainsVolume(bounds, volume))
            return false;

        const grown = RoomVolumeUtil.getExpandedVolume(volume, 1);
        for (const other of others)
        {
            if (other !== ignore && RoomVolumeUtil.volumesIntersect(grown, other))
                return false;
        }
        return true;
    },
    // A passage volume joining two volumes, or null if they intersect, are adjacent, or share no row,
    // column or layer.
    makePassageBetweenVolumes(volume1: RoomVolume, volume2: RoomVolume,
        maxPassageWidth: number, maxPassageHeight: number): RoomVolume | null
    {
        const rangeIntersections = getVolumeRangeIntersections(volume1, volume2);
        const ri = rangeIntersections.rowRangeIntersection;
        const ci = rangeIntersections.colRangeIntersection;
        const li = rangeIntersections.collisionLayerRangeIntersection;

        // Passage's direction should be parallel to the y-axis (i.e. axis which spans collisionLayers)
        if (ri != null && ci != null && li == null)
        {
            const [minPassageRow, numPassageRows] = fitCentered(ri, maxPassageWidth);
            const [minPassageCol, numPassageCols] = fitCentered(ci, maxPassageWidth);
            const passageCollisionLayerRange = NumUtil.getGapBetweenIntegerRanges(
                [volume1.collisionLayerMin, volume1.collisionLayerMax],
                [volume2.collisionLayerMin, volume2.collisionLayerMax]
            );
            if (passageCollisionLayerRange == null)
                return null;
            return new RoomVolume(
                minPassageRow, minPassageRow + numPassageRows - 1,
                minPassageCol, minPassageCol + numPassageCols - 1,
                passageCollisionLayerRange[0], passageCollisionLayerRange[1]);
        }
        // Passage's direction should be parallel to the x-axis (i.e. axis which spans cols)
        else if (ri != null && ci == null && li != null)
        {
            const [minPassageRow, numPassageRows] = fitCentered(ri, maxPassageWidth);
            const [minPassageCollisionLayer, numPassageCollisionLayers] = fitCentered(li, maxPassageHeight);
            const passageColRange = NumUtil.getGapBetweenIntegerRanges(
                [volume1.colMin, volume1.colMax],
                [volume2.colMin, volume2.colMax]
            );
            if (passageColRange == null)
                return null;
            return new RoomVolume(
                minPassageRow, minPassageRow + numPassageRows - 1,
                passageColRange[0], passageColRange[1],
                minPassageCollisionLayer, minPassageCollisionLayer + numPassageCollisionLayers - 1);
        }
        // Passage's direction should be parallel to the z-axis (i.e. axis which spans rows)
        else if (ri == null && ci != null && li != null)
        {
            const [minPassageCol, numPassageCols] = fitCentered(ci, maxPassageWidth);
            const [minPassageCollisionLayer, numPassageCollisionLayers] = fitCentered(li, maxPassageHeight);
            const passageRowRange = NumUtil.getGapBetweenIntegerRanges(
                [volume1.rowMin, volume1.rowMax],
                [volume2.rowMin, volume2.rowMax]
            );
            if (passageRowRange == null)
                return null;
            return new RoomVolume(
                passageRowRange[0], passageRowRange[1],
                minPassageCol, minPassageCol + numPassageCols - 1,
                minPassageCollisionLayer, minPassageCollisionLayer + numPassageCollisionLayers - 1);
        }
        else
            return null;
    },

    // Carves a volume from the (initially solid) grid in two passes: remove blocks, then finish the
    // enclosing faces based on what is still solid. This makes carving order-independent.
    carveOutVolume(voxels: Voxel[], volume: RoomVolume): void
    {
        if (!volumeCanBeApplied("carveOutVolume", volume) || !volume.palette)
            return;

        // Blocks removed via VoxelUpdateUtil (no room passed, so no validation), which updates faces
        // from actual solidity.
        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let col = volume.colMin; col <= volume.colMax; ++col)
            {
                for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
                {
                    VoxelUpdateUtil.removeVoxelBlock(undefined, voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer));
                }
            }
        }

        // Faces belong to the enclosing blocks and are drawn only where such a block exists.
        const palette = volume.palette;

        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
            {
                paintEnclosingFace(voxels, row, volume.colMin-1, "x", "+", layer, palette.wall);
                paintEnclosingFace(voxels, row, volume.colMax+1, "x", "-", layer, palette.wall);
            }
        }
        for (let col = volume.colMin; col <= volume.colMax; ++col)
        {
            for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
            {
                paintEnclosingFace(voxels, volume.rowMin-1, col, "z", "+", layer, palette.wall);
                paintEnclosingFace(voxels, volume.rowMax+1, col, "z", "-", layer, palette.wall);
            }
        }

        // Floor and ceiling; outside the layer range, the room's own floor/ceiling closes the volume
        // (see COLLISION_LAYER_NULL).
        const floorCollisionLayer = volume.collisionLayerMin - 1;
        const ceilingCollisionLayer = volume.collisionLayerMax + 1;

        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let col = volume.colMin; col <= volume.colMax; ++col)
            {
                paintEnclosingFace(voxels, row, col, "y", "+", floorCollisionLayer, palette.floor);
                paintEnclosingFace(voxels, row, col, "y", "-", ceilingCollisionLayer, palette.ceiling);
            }
        }
    },

    // Fills a volume solid (stair steps, props). Must come after carving. Order-independent like carving,
    // since VoxelUpdateUtil updates faces from actual solidity.
    fillVolume(voxels: Voxel[], volume: RoomVolume): void
    {
        if (!volumeCanBeApplied("fillVolume", volume) || !volume.palette)
            return;

        // Uses the palette like the room around it (walked on, seen from the side, passed under).
        const palette = volume.palette;
        const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(palette.wall);
        textures[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "+")] = palette.floor;
        textures[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "-")] = palette.ceiling;

        for (let row = volume.rowMin; row <= volume.rowMax; ++row)
        {
            for (let col = volume.colMin; col <= volume.colMax; ++col)
            {
                for (let layer = volume.collisionLayerMin; layer <= volume.collisionLayerMax; ++layer)
                {
                    VoxelUpdateUtil.addVoxelBlock(undefined, voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer), textures);
                }
            }
        }
    },
}

// A volume must be within the grid, correctly ordered, and have a palette (faces are finished from it).
// Touching the boundary wall is allowed.
function volumeCanBeApplied(methodName: string, volume: RoomVolume): boolean
{
    if (volume.rowMin < 0 || volume.rowMax > NUM_VOXEL_ROWS-1 ||
        volume.colMin < 0 || volume.colMax > NUM_VOXEL_COLS-1 ||
        volume.collisionLayerMin < COLLISION_LAYER_MIN ||
        volume.collisionLayerMax > COLLISION_LAYER_MAX ||
        volume.rowMin > volume.rowMax || volume.colMin > volume.colMax ||
        volume.collisionLayerMin > volume.collisionLayerMax)
    {
        console.error(`RoomVolumeUtil::${methodName} :: Volume's bounds are improper for baking (volume = ${JSON.stringify(volume)}).`);
        return false;
    }
    if (!volume.palette)
    {
        console.error(`RoomVolumeUtil::${methodName} :: Texture indices are not specified in the given volume (volume = ${JSON.stringify(volume)}).`);
        return false;
    }
    return true;
}

// The largest centred run of at most maxLength within the inclusive range, as [start, length].
function fitCentered(range: [number, number], maxLength: number): [number, number]
{
    const length = Math.max(1, Math.min(maxLength, range[1] - range[0] + 1));
    return [Math.floor(0.5 * (range[0] + range[1] - length + 1)), length];
}

// Finishes one enclosing face; drawn only if the enclosing block is solid (outside the layer range
// counts as solid, so room floors and ceilings are drawn).
function paintEnclosingFace(voxels: Voxel[], row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number): void
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (voxel == undefined)
        return; // outside the room, where there is no face to finish

    // Not setVoxelQuadTexture, which forces visibility; faces over carved blocks must stay undrawn.
    VoxelQuadUpdateUtil.setVoxelQuadVisible(
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer),
        voxel, facingAxis, orientation, getQuadCollisionLayer(collisionLayer), textureIndex);
}

// Room floor and ceiling faces share one layer position.
function getQuadCollisionLayer(collisionLayer: number): number
{
    return (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        ? COLLISION_LAYER_NULL : collisionLayer;
}

function getVolumeRangeIntersections(volume1: RoomVolume, volume2: RoomVolume): RoomVolumeRangeIntersections
{
    const rowIntersection = NumUtil.getRangeIntersection(
        [volume1.rowMin, volume1.rowMax], [volume2.rowMin, volume2.rowMax]);
    const colIntersection = NumUtil.getRangeIntersection(
        [volume1.colMin, volume1.colMax], [volume2.colMin, volume2.colMax]);
    const collisionLayerIntersection = NumUtil.getRangeIntersection(
        [volume1.collisionLayerMin, volume1.collisionLayerMax], [volume2.collisionLayerMin, volume2.collisionLayerMax]);
    return new RoomVolumeRangeIntersections(rowIntersection, colIntersection, collisionLayerIntersection);
}

export default RoomVolumeUtil;
