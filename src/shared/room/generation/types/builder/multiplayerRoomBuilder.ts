import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, NUM_VOXEL_ROWS } from "../../../../system/sharedConstants";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import { RoomVolumeTypeEnumMap } from "../roomVolumeType";
import ProceduralRoomBuilder from "./proceduralRoomBuilder";
import RoomBuilder from "./roomBuilder";

// How much of the room in front of the entrance is always kept as one open area, so that what an
// arriving player sees is a room rather than the back of a wall, and so that he is never boxed in by
// however the rest of the room came out.
const ARRIVAL_AREA_HALF_WIDTH = 3;
const ARRIVAL_AREA_DEPTH = 4;

// How much of the floor around the entrance is kept clear of anything generation places. This is the
// same stretch room editing protects, so that a generated room never arrives already holding
// something a player would not be allowed to build there (see @docs/geometry/room_entrance.md).
const ENTRANCE_KEEP_CLEAR_HALF_WIDTH = 2;
const ENTRANCE_KEEP_CLEAR_HALF_DEPTH = 3;

// What every multiplayer room has in common, whichever kind it is: a texture pack drawn for it, one
// fixed way in, and an area behind that way in for a player to arrive into.
export default abstract class MultiplayerRoomBuilder extends ProceduralRoomBuilder
{
    override run(): RoomBuilder
    {
        this.initPalettes();
        const arrivalPalette = this.nextPalette();

        // The way in. A room's boundary is mass like any other wall, so the doorway is a cavity cut
        // through it - a multiplayer room that failed to carve it would come out with no way in. It
        // is finished in the palette of the area it opens onto, since that is the room somebody
        // standing in the doorway is looking into.
        const entrance = RoomVolumeConstructorMap["MultiplayerEntrance"]();
        entrance.palette = arrivalPalette;
        this.addVolume(RoomVolumeTypeEnumMap.Entrance, entrance);

        // The area the doorway opens onto. It is placed rather than drawn, and placed first, so that
        // it is there whatever the rest of the room turns out to be: it reaches the boundary wall at
        // the entrance cell, which is what joins the doorway to the room.
        this.addArea(RoomVolumeConstructorMap["FirstStorey"](
            NUM_VOXEL_ROWS - 1 - ARRIVAL_AREA_DEPTH, NUM_VOXEL_ROWS - 2,
            MULTI_PLAYER_ENTRANCE_VOXEL_COL - ARRIVAL_AREA_HALF_WIDTH,
            MULTI_PLAYER_ENTRANCE_VOXEL_COL + ARRIVAL_AREA_HALF_WIDTH,
            arrivalPalette));

        this.addVolume(RoomVolumeTypeEnumMap.Reserved,
            RoomVolumeConstructorMap["MultiplayerEntranceZone"](
                ENTRANCE_KEEP_CLEAR_HALF_WIDTH, ENTRANCE_KEEP_CLEAR_HALF_DEPTH));
        return this;
    }
}
