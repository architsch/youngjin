import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import { PET_BODY_HEIGHT, PET_CLIMB_LAYERS, PET_HITBOX_WIDTH } from "../../graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z } from "../../system/sharedConstants";
import VoxelWalker from "../../voxel/types/voxelWalker";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import NpcFacingUtil from "./npcFacingUtil";
import ObjectObstacleUtil from "./objectObstacleUtil";

// A body that only touches a block isn't in it.
const CLEARANCE_MARGIN = 0.01;

// A pet as it finds its way about the grid (see VoxelPathUtil): lower than a player, and climbing higher.
export const PET_WALKER: VoxelWalker = {bodyLayers: Math.ceil(PET_BODY_HEIGHT / COLLISION_LAYER_HEIGHT),
    climbLayers: PET_CLIMB_LAYERS};

// A pet's body in a room. Its position is its middle, and its transform's direction points behind it, as a player's does
// (see FORWARD_DIR).
const PetBodyUtil =
{
    // Where a pet standing on a point of a floor has its middle; and back.
    getStandingPos: (feet: Vec3): Vec3 =>
    {
        return {x: feet.x, y: feet.y + 0.5 * PET_BODY_HEIGHT, z: feet.z};
    },
    getFeet: (pos: Vec3): Vec3 =>
    {
        return {x: pos.x, y: pos.y - 0.5 * PET_BODY_HEIGHT, z: pos.z};
    },
    getBox: (pos: Vec3): AABB3 =>
    {
        return {center: pos, halfSize: {x: 0.5 * PET_HITBOX_WIDTH, y: 0.5 * PET_BODY_HEIGHT, z: 0.5 * PET_HITBOX_WIDTH}};
    },
    // The transform direction of a pet that looks a way across the floor (see NpcFacingUtil), and back.
    getDir: (facing: number): Vec3 =>
    {
        const ahead = NpcFacingUtil.getDir(facing);
        return {x: -ahead.x, y: 0, z: -ahead.z};
    },
    getFacing: (dir: Vec3): number =>
    {
        return NpcFacingUtil.getDegrees({x: -dir.x, y: 0, z: -dir.z});
    },
    // Whether a pet with its middle there is inside the room, in no block, and in nothing as solid as one.
    isClear: (room: Room, pos: Vec3): boolean =>
    {
        const half = 0.5 * PET_HITBOX_WIDTH - CLEARANCE_MARGIN;
        const halfHeight = 0.5 * PET_BODY_HEIGHT - CLEARANCE_MARGIN;
        if (!(pos.x - half >= 0 && pos.x + half <= MAX_ROOM_X && pos.z - half >= 0 && pos.z + half <= MAX_ROOM_Z
            && pos.y - halfHeight >= 0 && pos.y + halfHeight <= MAX_ROOM_Y))
        {
            return false;
        }
        const voxels = room.voxelGrid.voxels;
        const lastRow = VoxelQueryUtil.getVoxelRowFromWorldZ(pos.z + half);
        const lastCol = VoxelQueryUtil.getVoxelColFromWorldX(pos.x + half);
        const lastLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(pos.y + halfHeight);
        for (let row = VoxelQueryUtil.getVoxelRowFromWorldZ(pos.z - half); row <= lastRow; ++row)
        {
            for (let col = VoxelQueryUtil.getVoxelColFromWorldX(pos.x - half); col <= lastCol; ++col)
            {
                for (let layer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(pos.y - halfHeight); layer <= lastLayer; ++layer)
                {
                    if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer))
                        return false;
                }
            }
        }
        return ObjectObstacleUtil.isBoxClear(room.objectById,
            {center: pos, halfSize: {x: half, y: halfHeight, z: half}});
    },
}

export default PetBodyUtil;
