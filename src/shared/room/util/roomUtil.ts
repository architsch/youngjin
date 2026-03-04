import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";

const RoomUtil =
{
    positionIsInRoom: (x: number, y: number, z: number): boolean =>
    {
        return x > 0 && x < NUM_VOXEL_COLS &&
            y > 0 && y < MAX_ROOM_Y &&
            z > 0 && z < NUM_VOXEL_ROWS;
    },
}

export default RoomUtil;