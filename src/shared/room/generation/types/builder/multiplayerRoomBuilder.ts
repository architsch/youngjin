import DoorObjectUtil from "../../../../object/util/doorObjectUtil";
import { INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import { RoomVolumeTypeEnumMap } from "../roomVolumeType";
import ProceduralRoomBuilder from "./proceduralRoomBuilder";
import RoomBuilder from "./roomBuilder";

// How much of the room in front of the entrance is always kept as one open area, so that what an
// arriving player sees is a room rather than the back of a wall, and so that he is never boxed in by
// however the rest of the room came out.
const ARRIVAL_AREA_HALF_WIDTH = 3;
const ARRIVAL_AREA_DEPTH = 4;

// How much of the floor around the entrance is kept clear of anything generation places, so that an
// arriving player is never boxed in by block work the room came out holding, and so that the wall
// the door hangs on is never built over from the inside (see @docs/geometry/room_entrance.md).
const ENTRANCE_KEEP_CLEAR_HALF_WIDTH = 2;
const ENTRANCE_KEEP_CLEAR_HALF_DEPTH = 3;

// What every multiplayer room has in common, whichever kind it is: one fixed way in, and an area
// behind that way in for a player to arrive into.
export default abstract class MultiplayerRoomBuilder extends ProceduralRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const arrivalPalette = this.nextPalette();

        // The area the way in opens onto. It is placed rather than drawn, and placed first, so that
        // it is there whatever the rest of the room turns out to be: it reaches the boundary wall at
        // the entrance cell, which is the stretch of wall the room's door is hung on.
        //
        // Nothing is cut through that wall. A door is a panel hung on it, like a picture, and an
        // attachment needs the wall behind it — so a cavity there would be the one place in the room
        // where the room's own door could not go.
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

    // The one object a procedurally generated room is furnished with: its own way in.
    //
    // Everything else in a Hub or Regular room is left for the people who use it to put there, but a
    // room with no door is a room nobody can leave — so the door is not furniture, it is part of
    // what makes the room a room. It is placed after the carving, because it hangs on a wall and the
    // walls are not settled until then.
    protected addEntranceDoor(): RoomBuilder
    {
        const {params, room} = this;
        const door = DoorObjectUtil.makeEntranceDoor(room.id, params.entranceVoxelCol,
            params.entranceVoxelRow, params.entranceVoxelCollisionLayer);
        room.objectGroup.objectById[door.objectId] = door;
        return this;
    }
}
