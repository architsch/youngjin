import User from "../../user/types/user";
import { UserTypeEnumMap } from "../../user/types/userType";
import Room from "../types/room";
import { RoomTypeEnumMap } from "../types/roomType";
import { SANDBOX_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";

// Permissions, derived only from the user and the room (identically on client and server).
const RoomValidationUtil =
{
    // A member owns exactly one room; non-empty ids are required so ownerless users never match.
    userOwnsRoom: (user: User, room: Room): boolean =>
    {
        return user.ownedRoomID.length > 0 && user.ownedRoomID == room.id;
    },
    // A property of the person, not the room.
    userIsAdmin: (user: User): boolean =>
    {
        return user.userType == UserTypeEnumMap.Admin;
    },
    // The user above restricted zones, who also manages doors and labels: admins in Hubs, the owner in
    // Regular rooms, anyone in the dev sandbox (see @docs/gameplay/restricted_zone.md).
    isRoomSuperuser: (user: User, room: Room): boolean =>
    {
        switch (room.roomType)
        {
            case RoomTypeEnumMap.Hub:
                return RoomValidationUtil.userIsAdmin(user);
            case RoomTypeEnumMap.Regular:
                return RoomValidationUtil.userOwnsRoom(user, room);
            case RoomTypeEnumMap.SinglePlayer:
                return room.roomName == SANDBOX_SINGLE_PLAYER_MODE;
            default:
                return false;
        }
    },
}

export default RoomValidationUtil;
