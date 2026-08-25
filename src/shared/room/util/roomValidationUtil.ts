import { UserRole, UserRoleEnumMap } from "../../user/types/userRole";
import { RoomVolumeConstructorMap } from "../generation/maps/roomVolumeConstructorMap";
import RoomVolume from "../generation/types/roomVolume";
import RoomVolumeUtil from "../generation/util/roomVolumeUtil";
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
    // Whether the given stretch of the room reaches into somewhere new block work may not go.
    // See [docs/geometry/room_entrance.md] for more details on the constraints.
    additionIsBlocked: (room: Room, volume: RoomVolume): boolean =>
    {
        return blockedBy(getNoAdditionZone(room), volume);
    },
    // Whether the given stretch of the room reaches into somewhere blocks may not be taken out of.
    // See [docs/geometry/room_entrance.md] for more details on the constraints.
    removalIsBlocked: (room: Room, volume: RoomVolume): boolean =>
    {
        return blockedBy(getNoRemovalZone(room), volume);
    },
}

function blockedBy(zone: RoomVolume | undefined, volume: RoomVolume): boolean
{
    return zone != undefined && RoomVolumeUtil.volumesIntersect(zone, volume);
}

// Where new blocks may not be placed, which keeps the spawn area and the approach to the doorway
// from being walled in. A Hub is a shared thoroughfare with heavy foot traffic, so it reserves more
// of the floor in front of its entrance than a Regular room does.
function getNoAdditionZone(room: Room): RoomVolume | undefined
{
    switch (room.roomType)
    {
        case RoomTypeEnumMap.Regular: return getZone(1, 1);
        case RoomTypeEnumMap.Hub: return getZone(1, 2);
        // A single-player room is rebuilt from its template each session and never persisted, so
        // there is nothing in it to protect.
        case RoomTypeEnumMap.SinglePlayer: return undefined;
        default: throw new Error(`Unknown roomType :: ${room.roomType}`);
    }
}

// Where blocks may not be taken out, which keeps the wall structure framing the doorway intact.
function getNoRemovalZone(room: Room): RoomVolume | undefined
{
    switch (room.roomType)
    {
        case RoomTypeEnumMap.Regular:
        case RoomTypeEnumMap.Hub: return getZone(1, 0);
        case RoomTypeEnumMap.SinglePlayer: return undefined;
        default: throw new Error(`Unknown roomType :: ${room.roomType}`);
    }
}

// A stretch of the room around the entrance, reaching the given number of cells out to either side
// of it and the given number in front of and behind it, over the height of the storey the entrance
// opens onto. See [docs/geometry/room_entrance.md].
//
// This is looked up on each call rather than captured once at module scope: this file sits inside an
// import cycle, and a constructor read at load time would depend on which module happened to be
// evaluated first.
function getZone(halfWidth: number, halfDepth: number): RoomVolume
{
    return RoomVolumeConstructorMap["MultiplayerEntranceZone"](halfWidth, halfDepth);
}

export default RoomValidationUtil;
