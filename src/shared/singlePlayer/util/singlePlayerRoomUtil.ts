import Vec3 from "../../math/types/vec3";
import { PLAYER_HEIGHT } from "../../object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectTagUtil from "../../object/util/objectTagUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z,
    SINGLE_PLAYER_START_TAG } from "../../system/sharedConstants";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";

// How far under a point the search for its floor begins, so a point on a ceiling isn't taken to be in it.
const FLOOR_SEARCH_INSET = 0.01;

const SinglePlayerRoomUtil =
{
    // Where a single-player room's player starts (the middle of their body): on the floor under the object
    // tagged as the start, or with none, in the middle of the room on its own floor.
    getPlayerStartPos: (room: Room): Vec3 =>
    {
        const marker = ObjectTagUtil.findObject(room, SINGLE_PLAYER_START_TAG)?.transform.pos;
        if (!marker)
            return {x: 0.5 * MAX_ROOM_X + 0.5, y: 0.5 * PLAYER_HEIGHT, z: 0.5 * MAX_ROOM_Z + 0.5};

        // (A stored position decodes a little off where it was put; see ObjectTransform.)
        const start = {x: round(marker.x), y: round(marker.y), z: round(marker.z)};
        const origin = {x: start.x, y: start.y - FLOOR_SEARCH_INSET, z: start.z};
        const drop = VoxelQueryUtil.getDistanceToOccupiedBlock(room.voxelGrid.voxels, origin,
            {x: 0, y: -1, z: 0}, MAX_ROOM_Y);
        const floorY = Math.max(0,
            COLLISION_LAYER_HEIGHT * Math.round((origin.y - drop) / COLLISION_LAYER_HEIGHT));
        return {x: start.x, y: floorY + 0.5 * PLAYER_HEIGHT, z: start.z};
    },
}

// To the nearest thousandth of a world unit, which is finer than anything is placed by.
function round(value: number): number
{
    return Math.round(1000 * value) / 1000;
}

export default SinglePlayerRoomUtil;
