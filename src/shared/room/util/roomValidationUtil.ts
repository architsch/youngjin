import User from "../../user/types/user";
import { UserTypeEnumMap } from "../../user/types/userType";
import Room from "../types/room";
import { RoomTypeEnumMap } from "../types/roomType";

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
    // The user above restricted zones (see @docs/gameplay/restricted_zone.md): admins in Hubs, the owner
    // in Regular rooms, the player in single-player rooms.
    isRoomSuperuser: (user: User, room: Room): boolean =>
    {
        switch (room.roomType)
        {
            case RoomTypeEnumMap.Hub:
                return RoomValidationUtil.userIsAdmin(user);
            case RoomTypeEnumMap.Regular:
                return RoomValidationUtil.userOwnsRoom(user, room);
            case RoomTypeEnumMap.SinglePlayer:
                return true;
            default:
                return false;
        }
    },
    // Doors shape the world: admin-only and Hub-only (Regular rooms keep their generated door).
    canUserManageDoors: (user: User, room: Room): boolean =>
    {
        return RoomValidationUtil.userIsAdmin(user) && room.roomType == RoomTypeEnumMap.Hub;
    },
}

export default RoomValidationUtil;
