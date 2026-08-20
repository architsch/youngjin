import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../system/sharedConstants";
import { UserRoleEnumMap } from "../../user/types/userRole";
import Voxel from "../../voxel/types/voxel";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import VoxelQuadUpdateUtil from "../../voxel/util/voxelQuadUpdateUtil";
import VoxelUpdateUtil from "../../voxel/util/voxelUpdateUtil";

// Leaves a face carrying whatever it already carried, for a caller changing whether it is drawn
// rather than what it is finished in.
const KEEP_TEXTURE = -1;

// The primitives every room generation routine writes voxels through: stacks of blocks raised and
// taken back out of one cell, and the faces of a cell finished or left undrawn. Everything above
// these works in volumes (see RoomGenerationVolumeUtil) and reaches the grid through here.
const RoomGenerationHelperUtil =
{
    // Fills a stack of collision layers of one cell with blocks, each face of each block carrying
    // the texture it is given. Which of those faces end up drawn is not this caller's to say: a
    // face is drawn where something solid meets something open, so adding one block settles it for
    // the blocks around it as well.
    addWall(voxels: Voxel[], row: number, col: number,
        quadTextureIndicesWithinLayer?: number[],
        collisionLayerMin: number = COLLISION_LAYER_MIN,
        collisionLayerMax: number = COLLISION_LAYER_MAX)
    {
        for (let collisionLayer = collisionLayerMin; collisionLayer <= collisionLayerMax; ++collisionLayer)
        {
            VoxelUpdateUtil.addVoxelBlock(UserRoleEnumMap.Owner, voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer),
                quadTextureIndicesWithinLayer);
        }
    },
    removeWall(voxels: Voxel[], row: number, col: number,
        collisionLayerMin: number = COLLISION_LAYER_MIN,
        collisionLayerMax: number = COLLISION_LAYER_MAX)
    {
        for (let collisionLayer = collisionLayerMin; collisionLayer <= collisionLayerMax; ++collisionLayer)
        {
            VoxelUpdateUtil.removeVoxelBlock(UserRoleEnumMap.Owner, voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer));
        }
    },
    // Finishes one face of one cell: what it carries, and whether it is drawn at all. This is how
    // the surfaces enclosing an open space are settled — a face belongs to whatever encloses the
    // space rather than to the space itself, so it is only ever drawn where there is something
    // there to draw it on.
    paintFace(voxels: Voxel[], row: number, col: number, facingAxis: "x" | "y" | "z",
        orientation: "-" | "+", collisionLayer: number, textureIndex: number, visible: boolean)
    {
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (voxel != undefined)
        {
            VoxelQuadUpdateUtil.setVoxelQuadVisible(visible, voxel, facingAxis, orientation,
                collisionLayer, textureIndex);
        }
    },
    // Leaves the upward face of a block undrawn, for a block whose top nobody is meant to be shown
    // however far above it the camera rises. The block itself stays exactly where it is: this takes
    // away the face, not the thing.
    hideUpwardFace(voxels: Voxel[], row: number, col: number, collisionLayer: number)
    {
        RoomGenerationHelperUtil.paintFace(voxels, row, col, "y", "+", collisionLayer,
            KEEP_TEXTURE, false);
    },
    // The six faces of a block, in the order addWall takes them: [-y, +y, -x, +x, -z, +z]. Every
    // piece of block work a generator raises is described this way — a step's tread and risers, a
    // plinth's top and sides — so the ordering is known here and nowhere else.
    getBoxTextureIndices(undersideTextureIndex: number, topTextureIndex: number,
        sideTextureIndex: number): number[]
    {
        return [undersideTextureIndex, topTextureIndex,
            sideTextureIndex, sideTextureIndex, sideTextureIndex, sideTextureIndex];
    },
}

export default RoomGenerationHelperUtil;
