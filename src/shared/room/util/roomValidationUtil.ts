import User from "../../user/types/user";
import { UserTypeEnumMap } from "../../user/types/userType";
import Room from "../types/room";
import { RoomTypeEnumMap } from "../types/roomType";

// Who may do what to a room. Every question here is asked of the person and of the room together,
// and of nothing else: there is no standing to be held or handed out, so the same person asking the
// same question about the same room always gets the same answer, on the client and on the server
// alike.
const RoomValidationUtil =
{
    // Whether this room is the one this user owns. A member is given exactly one room of his own when
    // he signs up, and it is the only room in the game that answers to a particular person — which is
    // what makes owning it a matter of comparing two ids rather than of consulting a roll.
    //
    // The emptiness check is what keeps everybody who owns no room at all — every guest, above all —
    // from being handed a room whose id happens to be empty too.
    userOwnsRoom: (user: User, room: Room): boolean =>
    {
        return user.ownedRoomID.length > 0 && user.ownedRoomID == room.id;
    },
    // Whether the user may change what this room is made of.
    //
    // A Hub is the game's own thoroughfare and is open to everyone to build in; a single-player room
    // has nobody in it but the player; and a Regular room is its owner's. What is *inside* a room he
    // may build in can still be closed to him — see RestrictedZoneUtil.
    canUserEditRoom: (user: User, room: Room): boolean =>
    {
        return room.roomType == RoomTypeEnumMap.Hub ||
            room.roomType == RoomTypeEnumMap.SinglePlayer ||
            RoomValidationUtil.userOwnsRoom(user, room);
    },
    // Whether the user is one of the few who shape the world itself rather than a room within it.
    // This is a property of the person, not of where he is standing, which is what makes it a
    // different question from every other permission here — those are all about one particular room.
    userIsAdmin: (user: User): boolean =>
    {
        return user.userType == UserTypeEnumMap.Admin;
    },
    // Whether the user is the one this room answers to. This is what a restricted zone is drawn by,
    // and what it does not apply to (see @docs/gameplay/restricted_zone.md).
    //
    // The answer comes from a different place in each kind of room: a Hub belongs to the game, so the
    // only person above its rules is an admin; a Regular room belongs to one person, so its owner is
    // that person; and a single-player room has nobody in it but the player, who can hardly need
    // protecting from himself.
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
