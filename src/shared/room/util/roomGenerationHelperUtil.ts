import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_VOXEL } from "../../system/sharedConstants";
import { UserRoleEnumMap } from "../../user/types/userRole";
import Voxel from "../../voxel/types/voxel";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../voxel/util/voxelUpdateUtil";

const RoomGenerationHelperUtil =
{
    addWall(voxels: Voxel[], row: number, col: number,
        quadTextureIndicesWithinLayer: number[],
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
    paintFloorAndCeilingTexture(quads: Uint8Array, row: number, col: number,
        floorTextureIndex: number, ceilingTextureIndex: number)
    {
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(row, col);
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-2] = 0b10000000 | ceilingTextureIndex;
        quads[startIndex + NUM_VOXEL_QUADS_PER_VOXEL-1] = 0b10000000 | floorTextureIndex;
    },
    /*paintFullWallTexture(quads: Uint8Array, row: number, col: number,
        facingAxis: "x" | "z", orientation: "-" | "+", wallTextureIndex: number)
    {
        for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
        {
            const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
            const offset = VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
            quads[startIndex + offset] = 0b10000000 | wallTextureIndex;
        }
    },*/
}

export default RoomGenerationHelperUtil;