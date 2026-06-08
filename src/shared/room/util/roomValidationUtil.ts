import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import { UserRole, UserRoleEnumMap } from "../../user/types/userRole";
import Room from "../types/room";
import { RoomTypeEnumMap } from "../types/roomType";

const RoomValidationUtil =
{
    canUserEditRoom: (userRole: UserRole, room: Room): boolean =>
    {
        return userRole == UserRoleEnumMap.Owner ||
            userRole == UserRoleEnumMap.Editor ||
            room.roomType == RoomTypeEnumMap.Hub ||
            room.roomType == RoomTypeEnumMap.SinglePlayer;
    },
    // See [docs/geometry/room_entrance.md] for more details on the constraints.
    additionIsBlockedAtCoords: (room: Room, col: number, row: number): boolean =>
    {
        if (row < 0 || col < 0 || row >= NUM_VOXEL_ROWS || col >= NUM_VOXEL_COLS)
            return true;
        switch (room.roomType)
        {
            case RoomTypeEnumMap.Regular:
                return Math.abs(col - MULTI_PLAYER_ENTRANCE_VOXEL_COL) <= 1 &&
                    Math.abs(row - MULTI_PLAYER_ENTRANCE_VOXEL_ROW) <= 1;
            case RoomTypeEnumMap.Hub:
                return Math.abs(col - MULTI_PLAYER_ENTRANCE_VOXEL_COL) <= 1 &&
                    Math.abs(row - MULTI_PLAYER_ENTRANCE_VOXEL_ROW) <= 2;
            case RoomTypeEnumMap.SinglePlayer:
                return false;
            default: throw new Error(`Unknown roomType :: ${room.roomType}`);
        }
    },
    // See [docs/geometry/room_entrance.md] for more details on the constraints.
    removalIsBlockedAtCoords: (room: Room, col: number, row: number): boolean =>
    {
        if (row < 0 || col < 0 || row >= NUM_VOXEL_ROWS || col >= NUM_VOXEL_COLS)
            return true;
        switch (room.roomType)
        {
            case RoomTypeEnumMap.Regular:
            case RoomTypeEnumMap.Hub:
                return Math.abs(col - MULTI_PLAYER_ENTRANCE_VOXEL_COL) <= 1 &&
                    row == MULTI_PLAYER_ENTRANCE_VOXEL_ROW;
            case RoomTypeEnumMap.SinglePlayer:
                return false;
            default: throw new Error(`Unknown roomType :: ${room.roomType}`);
        }
    },
}

export default RoomValidationUtil;