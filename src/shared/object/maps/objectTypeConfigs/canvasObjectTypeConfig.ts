import ImageMapUtil from "../../../image/util/imageMapUtil";
import Room from "../../../room/types/room";
import { RoomTypeEnumMap } from "../../../room/types/roomType";
import { MAX_CANVASES_PER_ROOM } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../user/types/userRole";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "../../types/objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import ObjectTypeConfigMap from "../objectTypeConfigMap";

// This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
const CanvasObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Canvas",
    persistent: true,
    canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
        // Block users who have no editing privilege
        const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
            userRole == UserRoleEnumMap.Owner ||
            userRole == UserRoleEnumMap.Editor;
        if (!userCanEditRoom)
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // Block users from adding too many canvases
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        const canvasCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (canvasCount >= MAX_CANVASES_PER_ROOM)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
        // Block users who have no editing privilege
        const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
            userRole == UserRoleEnumMap.Owner ||
            userRole == UserRoleEnumMap.Editor;
        if (!userCanEditRoom)
            return false;

        return true;
    },
    canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // Block users who have no editing privilege
        const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
            userRole == UserRoleEnumMap.Owner ||
            userRole == UserRoleEnumMap.Editor;
        if (!userCanEditRoom)
            return false;

        // Canvas movement must ignore physics
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        // Block users who have no editing privilege
        const userCanEditRoom = room.roomType == RoomTypeEnumMap.Hub ||
            userRole == UserRoleEnumMap.Owner ||
            userRole == UserRoleEnumMap.Editor;
        if (!userCanEditRoom)
            return false;

        // User can only set the canvas's image path and nothing else
        if (signal.metadataKey != ObjectMetadataKeyEnumMap.ImagePath)
            return false;
        if (!ImageMapUtil.getImageMap("CanvasImageMap").hasImagePath(signal.metadataValue))
            return false;

        return true;
    },
    components: {
        spawnedByAny: {
            collider: {
                colliderType: "wallAttachment",
                hitboxSize: {sizeX: 0.98, sizeY: 0.98, sizeZ: 0.01},
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {
                createInstanceIdPool: true,
            },
        },
    },
}

export default CanvasObjectTypeConfig;