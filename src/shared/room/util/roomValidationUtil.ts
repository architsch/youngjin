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
}

export default RoomValidationUtil;