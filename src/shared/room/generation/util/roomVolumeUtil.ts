import NumUtil from "../../../math/util/numUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS,
    NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS } from "../../../system/sharedConstants";
import Voxel from "../../../voxel/types/voxel";
import VoxelQuadUpdateUtil from "../../../voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../../voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../voxel/util/voxelUpdateUtil";
import RoomVolume from "../types/roomVolume";
import RoomVolumeRangeIntersections from "../types/roomVolumeRangeIntersections";

// A `Voxel` is a stack of blocks (i.e voxelBlocks). Each block is uniquely identified by its row, col, and collisionLayer.
// A `RoomVolume` is a box-shaped 3D region in which an integral number of voxels and their blocks can fit.
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
    // A copy of the volume with all six of its bounds pushed out by the given amount (pass a negative
    // amount to pull them in). Everything about keeping volumes apart is asked through this together
    // with volumesIntersect, and the two questions differ only in how many sides are expanded:
    //
    //   - volumesIntersect(getExpandedVolume(a, 1), b) is true exactly when a and b would touch,
    //     which is what a routine growing a volume rejects on. Refusing it leaves every pair
    //     separated by at least one voxel, i.e. by a wall.
    //   - volumesIntersect(getExpandedVolume(a, 1), getExpandedVolume(b, 1)) is true when they are
    //     within one voxel of each other. Alongside the above, which rules out touching, that means
    //     exactly one voxel of wall stands between them - which is where a passage can be cut.
    //
    // The height is expanded along with the footprint, so a volume sitting directly above another
    // answers these the same way one sitting beside it does.
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
    // Whether the volume stands entirely within `bounds` and clear of every one of `others` - clear
    // meaning not so much as touching, so that at least one voxel of matter is left between it and
    // each of them (see getExpandedVolume).
    //
    // `ignore` is for testing a grown copy of a volume that is itself among the others, which would
    // otherwise always be found to touch itself.
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
    // Returns a volume which connects the two given volume by joining one of its sides to that of the other.
    // Returns NULL if the two given volumes either:
    //   (1) Are intersecting each other, or
    //   (2) Are adjacent to each other, or
    //   (3) Do not have any row, column, or collisionLayer in common.
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

    // It is assumed that, during the initial state of room generation, the room is fully occupied by
    // blocks and has no empty space at all. Empty spaces must be created by "carving out" volumes
    // from this solid chunk of matter.
    //
    // A volume is carved in two passes, and the order matters: the blocks go first, and only then
    // are the surfaces they left behind finished. That is what makes carving order-independent -
    // carving the same set of volumes in any order leaves the same room, whether or not they touch
    // one another. Finishing a surface while a neighbouring volume is still solid, and never
    // revisiting it, is what leaves faces drawn in mid-air once that neighbour is carved too.
    carveOutVolume(voxels: Voxel[], volume: RoomVolume): void
    {
        if (!volumeCanBeApplied("carveOutVolume", volume) || !volume.palette)
            return;

        // The blocks. Removing one through VoxelUpdateUtil settles which faces of it and of every
        // block around it are drawn, from what is actually solid once it has gone - so a volume
        // carved into a neighbour that was carved earlier leaves no face standing between them.
        // No room is passed, which is what tells it not to validate: this is a room being generated
        // rather than a room being edited.
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

        // The surfaces. A face belongs to whatever encloses the volume rather than to the volume
        // itself, so it is finished on the enclosing block and drawn only where there is such a
        // block - where the volume opens into another one there is no surface between them at all.
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

        // The floor under the volume and the ceiling over it. Either may fall outside the collision
        // layers altogether, which is where the room's own floor or ceiling closes the volume off
        // instead of a slab of blocks (see COLLISION_LAYER_NULL).
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

    // The counterpart of carveOutVolume: stands the volume solid instead of hollowing it out. This
    // is how a carved room gets the block work it is left standing on - the steps of a flight, a
    // stack of props - and it can only come after the carving, since carving takes matter away and
    // has no way to express something that survives being carved.
    //
    // Adding a block through VoxelUpdateUtil settles the faces of it and of every block around it
    // from what is actually solid, exactly as removing one does, so filling is order-independent
    // for the same reason carving is: a block stood against something already solid leaves no face
    // drawn between the two.
    fillVolume(voxels: Voxel[], volume: RoomVolume): void
    {
        if (!volumeCanBeApplied("fillVolume", volume) || !volume.palette)
            return;

        // A block stood in a room is walked on from above, seen from the side, and passed under
        // from below where it stands over open floor - so it wears its palette the way the room
        // around it does rather than one texture all over.
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

// Whether a volume is something the grid can actually be made to hold: somewhere it reaches, and
// the right way round. A volume touching the outermost row or column is allowed rather than
// refused - that is the boundary wall, and a cavity cut through it is exactly what a room's
// entrance is.
//
// A volume with no palette is refused too. Every face a volume settles is finished from its
// palette, so a volume without one would leave the room's surfaces as whatever they happened to
// already be.
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

// The largest run of at most `maxLength` cells that fits in the given inclusive range, centred in
// it. Returned as [start, length].
function fitCentered(range: [number, number], maxLength: number): [number, number]
{
    const length = Math.max(1, Math.min(maxLength, range[1] - range[0] + 1));
    return [Math.floor(0.5 * (range[0] + range[1] - length + 1)), length];
}

// Finishes one face of whatever encloses a carved volume: what it carries, and whether it is drawn
// at all. It is drawn only where the enclosing block is solid - anywhere outside the collision
// layers counts as solid, which is how the room's own floor and ceiling always come out drawn.
function paintEnclosingFace(voxels: Voxel[], row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number): void
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (voxel == undefined)
        return; // outside the room, where there is no face to finish

    // Note: this deliberately does not go through VoxelUpdateUtil.setVoxelQuadTexture, which forces
    // the quad visible. A face over a block that has been carved away has to come out undrawn, or
    // it is left hanging in mid-air.
    VoxelQuadUpdateUtil.setVoxelQuadVisible(
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer),
        voxel, facingAxis, orientation, getQuadCollisionLayer(collisionLayer), textureIndex);
}

// The room's own floor and ceiling are not collision layers, so the faces that draw them are
// addressed by the one layer position that stands for both ends of the stack.
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
