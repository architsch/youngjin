import User from "../../user/types/user";
import { UserTypeEnumMap } from "../../user/types/userType";
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
    // Whether the user is one of the few who shape the world itself rather than a room within it.
    // This is a property of the person, not of where he is standing, which is what makes it a
    // different question from every other permission here — those are all about a role a user holds
    // in one particular room.
    userIsAdmin: (user: User): boolean =>
    {
        return user.userType == UserTypeEnumMap.Admin;
    },
    // Whether the user may put up, take down, move, or re-wire the doors of this room.
    //
    // Doors are how rooms are joined to one another, so laying one is an edit to the world's shape
    // rather than to a room's contents — which is why editing a room is not enough to be allowed it,
    // and why an admin is not allowed it everywhere either. A Hub is the game's own room and the
    // thoroughfare the world is built out of; a Regular room belongs to one person, and keeps the
    // one door generation gave it so that nobody, admin included, rearranges the way into somebody
    // else's room.
    canUserManageDoors: (user: User, room: Room): boolean =>
    {
        return RoomValidationUtil.userIsAdmin(user) && room.roomType == RoomTypeEnumMap.Hub;
    },
}

export default RoomValidationUtil;
