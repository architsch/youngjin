import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_QUADS_PER_VOXEL } from "../../system/sharedConstants";
import { UserRoleEnumMap } from "../../user/types/userRole";
import Voxel from "../../voxel/types/voxel";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../voxel/util/voxelUpdateUtil";
import RoomGenerationRect from "../types/roomGeneration/roomGenerationRect";

const RoomGenerationHelperUtil =
{
    // Hollows out a multiplayer room's entrance cell up to the doorway's height, so that an
    // arriving player does not spawn inside the boundary wall. Every routine that raises that
    // wall has to call this afterwards, or the room ends up with no way in.
    carveMultiplayerEntrance(voxels: Voxel[])
    {
        RoomGenerationHelperUtil.removeWall(voxels,
            MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL,
            COLLISION_LAYER_MIN, 4);
    },
    addWall(voxels: Voxel[], row: number, col: number,
        quadTextureIndicesWithinLayer?: number[],
        collisionLayerMin: number = COLLISION_LAYER_MIN,
        collisionLayerMax: number = COLLISION_LAYER_MAX)
    {
        if (collisionLayerMin == COLLISION_LAYER_MIN &&
            collisionLayerMax == COLLISION_LAYER_MAX &&
            quadTextureIndicesWithinLayer)
        {
            RoomGenerationHelperUtil.paintFloorAndCeilingTexture(voxels[0].quadsMem.quads, row, col,
                quadTextureIndicesWithinLayer[1], quadTextureIndicesWithinLayer[0]);
        }
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
    paintFullWallTexture(quads: Uint8Array, row: number, col: number,
        facingAxis: "x" | "z", orientation: "-" | "+", wallTextureIndex: number)
    {
        for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
        {
            const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
            const offset = VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
            quads[startIndex + offset] = 0b10000000 | wallTextureIndex;
        }
    },
    rectContains(rect: RoomGenerationRect, row: number, col: number): boolean
    {
        return row >= rect.rowStart && row < rect.rowStart + rect.numRows &&
            col >= rect.colStart && col < rect.colStart + rect.numCols;
    },
    // Shrinks a rect inwards on all four sides. The result can come out empty (i.e. with a
    // non-positive extent), which the caller is expected to treat as "nothing fits in here".
    insetRect(rect: RoomGenerationRect, margin: number): RoomGenerationRect
    {
        return {
            rowStart: rect.rowStart + margin,
            colStart: rect.colStart + margin,
            numRows: rect.numRows - 2 * margin,
            numCols: rect.numCols - 2 * margin,
        };
    },
}

export default RoomGenerationHelperUtil;
