import Vec3 from "../../../math/types/vec3";
import NumUtil from "../../../math/util/numUtil";
import Room from "../../../room/types/room";
import RoomVolume from "../../../room/types/roomVolume";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import StringUtil from "../../../math/util/stringUtil";
import { COLLISION_LAYER_HEIGHT, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z, OBJECT_USER_NAME_MAX_LENGTH,
    VOXEL_CELL_SIZE } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import ObjectTransform from "../objectTransform";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import LabelTextUtil from "../../util/labelTextUtil";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import ObjectTypeConfig from "./objectTypeConfig";

// A volume's size at unit scale along every axis: large enough that a stored scale reaches across the room (see
// ObjectTransform), and a whole number of blocks.
const BASE_SIZE = 2;
const SCALE_PER_BLOCK = VOXEL_CELL_SIZE / BASE_SIZE;

// A named box of the room's blocks, which draws nothing and stops nobody. Its Label is its name, and its
// transform its box, which lies on the block grid: the box's middle, and its size as a scale. One kept for a
// user (its ZoneUserName) is a restricted zone (see RestrictedZoneUtil), and a room's script acts on what one
// marks (see @docs/networking/single_player_mode.md). Only an admin or the room's superuser lays one.
const VolumeObjectTypeConfig =
{
    objectType: "Volume",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Volume,
    scaling: {
        scaleStep: {x: SCALE_PER_BLOCK, y: SCALE_PER_BLOCK, z: SCALE_PER_BLOCK},
        minScale: {x: SCALE_PER_BLOCK, y: SCALE_PER_BLOCK, z: SCALE_PER_BLOCK},
        maxScale: {x: MAX_ROOM_X / BASE_SIZE, y: MAX_ROOM_Y / BASE_SIZE, z: MAX_ROOM_Z / BASE_SIZE},
        getDefaultScale: () => ({x: SCALE_PER_BLOCK, y: SCALE_PER_BLOCK, z: SCALE_PER_BLOCK}),
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!canUserManage(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // The name it comes with must be one it could be given later, and so must whom it is kept for.
        const zoneUserName = obj.metadata[ObjectMetadataKeyEnumMap.ZoneUserName]?.str ?? "";
        return LabelTextUtil.isShortName(LabelTextUtil.getText(obj))
            && StringUtil.truncateByCodePoints(zoneUserName, OBJECT_USER_NAME_MAX_LENGTH) == zoneUserName;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return canUserManage(user, room);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!canUserManage(user, room))
            return false;

        // A volume is resized by its corners, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!canUserManage(user, room))
            return false;

        // Its Label is a name, which is short. Whom it is kept for is all else there is to set of it.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.Label)
            return LabelTextUtil.isShortName(signal.metadataValue);
        return signal.metadataKey == ObjectMetadataKeyEnumMap.ZoneUserName;
    },
    components: {
        spawnedByAny: {
            // Only what gives the box its size: nothing collides with it.
            collider: {
                baseHitboxSize: {sizeX: BASE_SIZE, sizeY: BASE_SIZE, sizeZ: BASE_SIZE},
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
        },
    },
    util: {
        // As read (see LabelTextUtil.toName), which is what a volume is looked up by.
        getName: (obj: AddObjectSignal): string =>
        {
            return LabelTextUtil.toName(LabelTextUtil.getText(obj));
        },
        // The first of the room's volumes with the name, in the order the room holds them.
        findByName: (room: Room, name: string): AddObjectSignal | undefined =>
        {
            return Object.values(room.objectById).find(obj => isVolume(obj) && getName(obj) == name);
        },
        // Whom the volume is kept for, which makes it a restricted zone: a user's name, or
        // ZONE_USER_NAME_FOR_NOBODY. "" for a volume that is no zone.
        getZoneUserName: (obj: AddObjectSignal): string =>
        {
            return (obj.metadata[ObjectMetadataKeyEnumMap.ZoneUserName]?.str ?? "").trim();
        },
        // The box's two opposite corners, in world units.
        getBox: (transform: ObjectTransform): {min: Vec3, max: Vec3} =>
        {
            return getBox(transform);
        },
        // The blocks the box covers.
        getRoomVolume: (transform: ObjectTransform): RoomVolume =>
        {
            const {min, max} = getBox(transform);
            return new RoomVolume(
                Math.round(min.z / VOXEL_CELL_SIZE), Math.round(max.z / VOXEL_CELL_SIZE) - 1,
                Math.round(min.x / VOXEL_CELL_SIZE), Math.round(max.x / VOXEL_CELL_SIZE) - 1,
                Math.round(min.y / COLLISION_LAYER_HEIGHT), Math.round(max.y / COLLISION_LAYER_HEIGHT) - 1);
        },
        // The transform of the box between two opposite corners, in any order: on the block grid, inside the
        // room, and no thinner than a block.
        makeTransform: (cornerA: Vec3, cornerB: Vec3): ObjectTransform =>
        {
            const x = getSpan(cornerA.x, cornerB.x, VOXEL_CELL_SIZE, MAX_ROOM_X);
            const y = getSpan(cornerA.y, cornerB.y, COLLISION_LAYER_HEIGHT, MAX_ROOM_Y);
            const z = getSpan(cornerA.z, cornerB.z, VOXEL_CELL_SIZE, MAX_ROOM_Z);
            return new ObjectTransform(
                {x: 0.5 * (x.min + x.max), y: 0.5 * (y.min + y.max), z: 0.5 * (z.min + z.max)},
                {x: 0, y: 0, z: 1},
                {x: (x.max - x.min) / BASE_SIZE, y: (y.max - y.min) / BASE_SIZE, z: (z.max - z.min) / BASE_SIZE});
        },
        // The transform of the box that covers the given blocks, which getRoomVolume reads back from it.
        makeTransformOfRoomVolume: (blocks: RoomVolume): ObjectTransform =>
        {
            return makeTransform(
                {x: blocks.colMin * VOXEL_CELL_SIZE, y: blocks.collisionLayerMin * COLLISION_LAYER_HEIGHT,
                    z: blocks.rowMin * VOXEL_CELL_SIZE},
                {x: (blocks.colMax + 1) * VOXEL_CELL_SIZE, y: (blocks.collisionLayerMax + 1) * COLLISION_LAYER_HEIGHT,
                    z: (blocks.rowMax + 1) * VOXEL_CELL_SIZE});
        },
    },
} satisfies ObjectTypeConfig;

// An admin anywhere, and a room's superuser in it: whoever draws a room's zones draws them as volumes.
function canUserManage(user: User, room: Room): boolean
{
    return RoomValidationUtil.userIsAdmin(user) || RoomValidationUtil.isRoomSuperuser(user, room);
}

function isVolume(obj: AddObjectSignal): boolean
{
    return obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType(VolumeObjectTypeConfig.objectType);
}

function getName(obj: AddObjectSignal): string
{
    return VolumeObjectTypeConfig.util.getName(obj);
}

function makeTransform(cornerA: Vec3, cornerB: Vec3): ObjectTransform
{
    return VolumeObjectTypeConfig.util.makeTransform(cornerA, cornerB);
}

// Snapped onto the block grid, since a stored position decodes a little off it (see ObjectTransform).
function getBox(transform: ObjectTransform): {min: Vec3, max: Vec3}
{
    const size = ObjectScaleUtil.getObjectSize(
        ObjectTypeConfigMap.getIndexByType(VolumeObjectTypeConfig.objectType), transform.scale);
    const snap = (value: number, step: number) => step * Math.round(value / step) + 0; // (+ 0: never -0)
    return {
        min: {
            x: snap(transform.pos.x - 0.5 * size.x, VOXEL_CELL_SIZE),
            y: snap(transform.pos.y - 0.5 * size.y, COLLISION_LAYER_HEIGHT),
            z: snap(transform.pos.z - 0.5 * size.z, VOXEL_CELL_SIZE),
        },
        max: {
            x: snap(transform.pos.x + 0.5 * size.x, VOXEL_CELL_SIZE),
            y: snap(transform.pos.y + 0.5 * size.y, COLLISION_LAYER_HEIGHT),
            z: snap(transform.pos.z + 0.5 * size.z, VOXEL_CELL_SIZE),
        },
    };
}

// The stretch between two coordinates along one axis, on the grid, within [0, limit] and at least a step long.
function getSpan(a: number, b: number, step: number, limit: number): {min: number, max: number}
{
    const snap = (value: number) => NumUtil.clampInRange(step * Math.round(value / step), 0, limit);
    const min = Math.min(snap(a), snap(b));
    const max = Math.max(snap(a), snap(b));
    if (max - min >= step)
        return {min, max};
    return (min + step <= limit) ? {min, max: min + step} : {min: limit - step, max: limit};
}

export default VolumeObjectTypeConfig;
