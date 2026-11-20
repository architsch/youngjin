import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import DoorEntranceUtil from "../../../shared/object/util/doorEntranceUtil";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import Room from "../../../shared/room/types/room";
import { MAX_ROOM_X, MAX_ROOM_Z, UNIT_VEC3 } from "../../../shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

// Where an arriving player is placed (RoomPickerUtil decides the room). Tries in order: the named door,
// a default-entrance door, any door, the room centre. Where at a door, DoorEntranceUtil says.
const SpawnHotspotUtil =
{
    pickSpawnTransform: (room: Room, destinationDoorLabel: string): ObjectTransform =>
    {
        const doors = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === doorTypeIndex);

        // Matched as read, so a plate's line breaks and spacing don't change what it is called.
        const destinationDoorName = LabelTextUtil.toName(destinationDoorLabel);
        if (destinationDoorName.length > 0)
        {
            const named = doors.filter(door =>
                LabelTextUtil.toName(LabelTextUtil.getText(door)) === destinationDoorName);
            if (named.length > 0)
                return DoorEntranceUtil.getArrivalTransform(room, pickOne(named));
        }

        const defaultEntrances = doors.filter(door =>
            DoorObjectTypeConfig.util.getDoorType(door) === DoorTypeEnumMap.DefaultEntrance);
        if (defaultEntrances.length > 0)
            return DoorEntranceUtil.getArrivalTransform(room, pickOne(defaultEntrances));

        if (doors.length > 0)
            return DoorEntranceUtil.getArrivalTransform(room, pickOne(doors));

        return getRoomCenterTransform();
    },
}

// Doors may share a label; pick one at random.
function pickOne(doors: AddObjectSignal[]): AddObjectSignal
{
    return doors[Math.floor(Math.random() * doors.length)];
}

// Last resort for rooms without doors.
function getRoomCenterTransform(): ObjectTransform
{
    return new ObjectTransform(
        {x: 0.5 * MAX_ROOM_X, y: 0.5 * PLAYER_HEIGHT, z: 0.5 * MAX_ROOM_Z},
        {x: 0, y: 0, z: 1}, {...UNIT_VEC3});
}

export default SpawnHotspotUtil;
