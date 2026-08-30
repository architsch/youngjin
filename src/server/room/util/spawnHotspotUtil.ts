import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import DoorObjectUtil from "../../../shared/object/util/doorObjectUtil";
import Room from "../../../shared/room/types/room";
import { DOOR_FOOTPRINT_HEIGHT, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    PLAYER_HEIGHT } from "../../../shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

// How far out from a door's face the arriving player stands. Far enough that he is not inside the
// panel, close enough that the room's own door is still behind him — which is what makes his first
// stride a step into the room rather than a walk up to it (see PlayerController).
const SPAWN_DISTANCE_FROM_DOOR = 0.6;

// Where a player arriving in a room is put down. The counterpart of RoomPickerUtil: that decides
// which room a user is headed for, and this decides where in it they land.
//
// A room may hold several doors now, so this is a real question rather than a fixed cell. It is
// answered by asking, in turn, for something more and more general — the door the traveller named,
// then any door the room offers as a way in, then any door at all, then the room itself. Each step
// is a room the previous answer did not exist in: a door may have been renamed or taken down since
// whoever pointed at it did so, a room's admin may have marked none of its doors as a way in, and a
// room may have no door left at all.
const SpawnHotspotUtil =
{
    pickSpawnTransform: (room: Room, destinationDoorLabel: string): ObjectTransform =>
    {
        const doors = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === doorTypeIndex);

        if (destinationDoorLabel.length > 0)
        {
            const named = doors.filter(door => DoorObjectUtil.getLabel(door) === destinationDoorLabel);
            if (named.length > 0)
                return getTransformBehindDoor(pickOne(named));
        }

        const defaultEntrances = doors.filter(door =>
            DoorObjectUtil.getDoorType(door) === DoorTypeEnumMap.DefaultEntrance);
        if (defaultEntrances.length > 0)
            return getTransformBehindDoor(pickOne(defaultEntrances));

        if (doors.length > 0)
            return getTransformBehindDoor(pickOne(doors));

        return getRoomCenterTransform();
    },
}

// Several doors may answer to one name — a room can be given two ways in from the same place on
// purpose — and there is nothing to choose between them, so the choice is drawn.
function pickOne(doors: AddObjectSignal[]): AddObjectSignal
{
    return doors[Math.floor(Math.random() * doors.length)];
}

// Where a player stands to have just come through the given door: a pace out from its face, on the
// floor the door stands on, facing away from it into the room.
//
// A door's origin sits at the middle of its own height while the door stands on the floor, so the
// floor is half a footprint below it; the player's own origin is likewise at the middle of his
// height. The direction is flipped because a player's transform is authored pointing behind him
// (see PlayerProximityDetector) — so facing away from the door is the door's own facing reversed.
function getTransformBehindDoor(door: AddObjectSignal): ObjectTransform
{
    const {pos, dir} = door.transform;
    const floorY = pos.y - 0.5 * DOOR_FOOTPRINT_HEIGHT;
    const spawnPos: Vec3 = {
        x: pos.x + dir.x * SPAWN_DISTANCE_FROM_DOOR,
        y: floorY + 0.5 * PLAYER_HEIGHT,
        z: pos.z + dir.z * SPAWN_DISTANCE_FROM_DOOR,
    };
    return new ObjectTransform(spawnPos, {x: -dir.x, y: 0, z: -dir.z});
}

// The last resort, for a room holding no door at all. Somewhere in it is better than nowhere, and
// the middle is the one place every room has.
function getRoomCenterTransform(): ObjectTransform
{
    return new ObjectTransform(
        {x: 0.5 * NUM_VOXEL_COLS, y: 0.5 * PLAYER_HEIGHT, z: 0.5 * NUM_VOXEL_ROWS},
        {x: 0, y: 0, z: 1});
}

export default SpawnHotspotUtil;
