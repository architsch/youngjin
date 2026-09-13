import DoorObjectTypeConfig from "../../../../object/types/objectTypeConfig/doorObjectTypeConfig";
import { INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import { RoomVolumeTypeEnumMap } from "../roomVolumeType";
import ProceduralRoomBuilder from "./proceduralRoomBuilder";
import RoomBuilder from "./roomBuilder";

// Half-width of the open arrival area in front of the entrance.
const ARRIVAL_AREA_HALF_WIDTH = 3;
const ARRIVAL_AREA_DEPTH = 4;

// Half-width of the keep-clear floor around the entrance (see @docs/geometry/room_entrance.md).
const ENTRANCE_KEEP_CLEAR_HALF_WIDTH = 2;
const ENTRANCE_KEEP_CLEAR_HALF_DEPTH = 3;

// Shared by multiplayer rooms: one fixed entrance and an arrival area behind it.
export default abstract class MultiplayerRoomBuilder extends ProceduralRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const arrivalPalette = this.nextPalette();

        // The arrival area, placed first so it always exists; it reaches the boundary wall at the
        // entrance cell, where the door hangs (the wall stays solid, since attachments need it).
        this.addArea(RoomVolumeConstructorMap["FirstStorey"](
            NUM_VOXEL_ROWS - 1 - ARRIVAL_AREA_DEPTH, NUM_VOXEL_ROWS - 2,
            INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - ARRIVAL_AREA_HALF_WIDTH,
            INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + ARRIVAL_AREA_HALF_WIDTH,
            arrivalPalette));

        this.addVolume(RoomVolumeTypeEnumMap.Reserved,
            RoomVolumeConstructorMap["InitialMultiplayerEntranceZone"](
                ENTRANCE_KEEP_CLEAR_HALF_WIDTH, ENTRANCE_KEEP_CLEAR_HALF_DEPTH));
        return this;
    }

    // The only generated object: the entrance door (a room without one can't be left). Added after
    // carving, once the walls exist.
    protected addEntranceDoor(): RoomBuilder
    {
        const {params, room} = this;
        const door = DoorObjectTypeConfig.util.makeEntranceDoor(room.id, params.entranceVoxelCol,
            params.entranceVoxelRow, params.entranceVoxelCollisionLayer);
        room.objectGroup.objectById[door.objectId] = door;
        return this;
    }
}
