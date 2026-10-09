import DoorObjectTypeConfig from "../../../../object/types/objectTypeConfig/doorObjectTypeConfig";
import VoxelQueryUtil from "../../../../voxel/util/voxelQueryUtil";
import { RoomVolumeConstructorMap } from "../../maps/roomVolumeConstructorMap";
import RoomPalette from "../roomPalette";
import RoomVolume from "../roomVolume";
import { RoomVolumeTypeEnumMap } from "../roomVolumeType";
import ProceduralRoomBuilder from "./proceduralRoomBuilder";
import RoomBuilder from "./roomBuilder";

// The open arrival area in front of the entrance door, in voxels: how far it reaches to either side of the
// door's middle, and out from the door's wall.
const ARRIVAL_AREA_HALF_WIDTH = 7;
const ARRIVAL_AREA_DEPTH = 8;

// The floor kept clear in front of the door, likewise (see @docs/geometry/room_entrance.md).
const ENTRANCE_KEEP_CLEAR_HALF_WIDTH = 5;
const ENTRANCE_KEEP_CLEAR_DEPTH = 6;

// Shared by multiplayer rooms: one fixed entrance and an arrival area behind it.
export default abstract class MultiplayerRoomBuilder extends ProceduralRoomBuilder
{
    override run(): RoomBuilder
    {
        super.run();

        const arrivalPalette = this.nextPalette();

        // The arrival area, placed first so it always exists; it reaches the boundary wall where the door
        // hangs (the wall stays solid, since attachments need it).
        this.addArea(this.makeVolumeBeforeEntrance(ARRIVAL_AREA_HALF_WIDTH, ARRIVAL_AREA_DEPTH, arrivalPalette));

        this.addVolume(RoomVolumeTypeEnumMap.Reserved,
            this.makeVolumeBeforeEntrance(ENTRANCE_KEEP_CLEAR_HALF_WIDTH, ENTRANCE_KEEP_CLEAR_DEPTH));
        return this;
    }

    // The only generated object: the entrance door (a room without one can't be left). Added after
    // carving, once the walls exist.
    protected addEntranceDoor(): RoomBuilder
    {
        const {params, room} = this;
        room.objectGroup.addObject(DoorObjectTypeConfig.util.makeEntranceDoor(room.id, params.entrancePos));
        return this;
    }

    // A stretch of the first storey in front of the entrance door, which hangs on the wall along the
    // room's last rows.
    private makeVolumeBeforeEntrance(halfWidth: number, depth: number, palette?: RoomPalette): RoomVolume
    {
        const {entrancePos} = this.params;
        const firstColPastMiddle = VoxelQueryUtil.getVoxelColFromWorldX(entrancePos.x);
        const firstWallRow = VoxelQueryUtil.getVoxelRowFromWorldZ(entrancePos.z);
        return RoomVolumeConstructorMap["FirstStorey"](firstWallRow - depth, firstWallRow - 1,
            firstColPastMiddle - halfWidth, firstColPastMiddle + halfWidth - 1, palette);
    }
}
