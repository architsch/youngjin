import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import DoorObjectTypeConfig, { SPAWN_DIST_BEHIND_DOOR } from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import Room from "../../../shared/room/types/room";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

// How much wall a door claims, which is what its origin sits at the middle of.
const DOOR_FOOTPRINT_HEIGHT =
    DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY;

// Where an arriving player is placed (RoomPickerUtil decides the room). Tries in order: the named door,
// a default-entrance door, any door, the room centre.
const SpawnHotspotUtil =
{
    pickSpawnTransform: (room: Room, destinationDoorLabel: string): ObjectTransform =>
    {
        const doors = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === doorTypeIndex);

        if (destinationDoorLabel.length > 0)
        {
            const named = doors.filter(door => DoorObjectTypeConfig.util.getLabel(door) === destinationDoorLabel);
            if (named.length > 0)
                return getTransformBehindDoor(pickOne(named));
        }

        const defaultEntrances = doors.filter(door =>
            DoorObjectTypeConfig.util.getDoorType(door) === DoorTypeEnumMap.DefaultEntrance);
        if (defaultEntrances.length > 0)
            return getTransformBehindDoor(pickOne(defaultEntrances));

        if (doors.length > 0)
            return getTransformBehindDoor(pickOne(doors));

        return getRoomCenterTransform();
    },
}

// Doors may share a label; pick one at random.
function pickOne(doors: AddObjectSignal[]): AddObjectSignal
{
    return doors[Math.floor(Math.random() * doors.length)];
}

// Behind the door's face, on its floor, facing into the room (PlayerController walks the player out).
// Door and player origins are at mid-height; the player's transform direction points behind them
// (see PlayerProximityDetector), hence the flip.
function getTransformBehindDoor(door: AddObjectSignal): ObjectTransform
{
    const {pos, dir} = door.transform;
    const floorY = pos.y - 0.5 * DOOR_FOOTPRINT_HEIGHT;
    const spawnPos: Vec3 = {
        x: pos.x - dir.x * SPAWN_DIST_BEHIND_DOOR,
        y: floorY + 0.5 * PLAYER_HEIGHT,
        z: pos.z - dir.z * SPAWN_DIST_BEHIND_DOOR,
    };
    return new ObjectTransform(spawnPos, {x: -dir.x, y: 0, z: -dir.z});
}

// Last resort for rooms without doors.
function getRoomCenterTransform(): ObjectTransform
{
    return new ObjectTransform(
        {x: 0.5 * NUM_VOXEL_COLS, y: 0.5 * PLAYER_HEIGHT, z: 0.5 * NUM_VOXEL_ROWS},
        {x: 0, y: 0, z: 1});
}

export default SpawnHotspotUtil;
