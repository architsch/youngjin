import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../system/sharedConstants";
import { UserRole, UserRoleEnumMap } from "../../user/types/userRole";
import Room from "../types/room";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import { RoomTypeEnumMap } from "../types/roomType";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

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
    additionIsBlocked: (room: Room, volume: RoomGenerationVolume): boolean =>
    {
        return blockedBy(getNoAdditionZone(room), volume);
    },
    // Whether the given stretch of the room reaches into somewhere blocks may not be taken out of.
    // See [docs/geometry/room_entrance.md] for more details on the constraints.
    removalIsBlocked: (room: Room, volume: RoomGenerationVolume): boolean =>
    {
        return blockedBy(getNoRemovalZone(room), volume);
    },
}

function blockedBy(zone: RoomGenerationVolume | undefined, volume: RoomGenerationVolume): boolean
{
    return zone != undefined && RoomGenerationVolumeUtil.overlaps(zone, volume);
}

// Where new blocks may not be placed, which keeps the spawn area and the approach to the doorway
// from being walled in. A Hub is a shared thoroughfare with heavy foot traffic, so it reserves more
// of the floor in front of its entrance than a Regular room does.
function getNoAdditionZone(room: Room): RoomGenerationVolume | undefined
{
    switch (room.roomType)
    {
        case RoomTypeEnumMap.Regular: return getEntranceZone(1, 1);
        case RoomTypeEnumMap.Hub: return getEntranceZone(1, 2);
        // A single-player room is rebuilt from its template each session and never persisted, so
        // there is nothing in it to protect.
        case RoomTypeEnumMap.SinglePlayer: return undefined;
        default: throw new Error(`Unknown roomType :: ${room.roomType}`);
    }
}

// Where blocks may not be taken out, which keeps the wall structure framing the doorway intact.
function getNoRemovalZone(room: Room): RoomGenerationVolume | undefined
{
    switch (room.roomType)
    {
        case RoomTypeEnumMap.Regular:
        case RoomTypeEnumMap.Hub: return getEntranceZone(1, 0);
        case RoomTypeEnumMap.SinglePlayer: return undefined;
        default: throw new Error(`Unknown roomType :: ${room.roomType}`);
    }
}

// A stretch of the room around the entrance, reaching the given number of cells out to either side
// of it and the given number in front of and behind it.
//
// It stands only as high as the storey the entrance opens onto. Everything these zones exist to
// protect — the doorway, the wall framing it, the floor an arriving player spawns on — is on that
// storey, and the room above it is ordinary room: somewhere an owner should be as free to build as
// anywhere else, and which nobody can even reach the doorway from.
function getEntranceZone(halfWidth: number, halfDepth: number): RoomGenerationVolume
{
    return {
        ...RoomGenerationVolumeUtil.GROUND_STOREY,
        rowStart: MULTI_PLAYER_ENTRANCE_VOXEL_ROW - halfDepth,
        colStart: MULTI_PLAYER_ENTRANCE_VOXEL_COL - halfWidth,
        numRows: 2 * halfDepth + 1, numCols: 2 * halfWidth + 1,
    };
}

export default RoomValidationUtil;
