import ImageMapUtil from "../../../image/util/imageMapUtil";
import Room from "../../../room/types/room";
import { RoomTypeEnumMap } from "../../../room/types/roomType";
import { MAX_CANVASES_PER_ROOM } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../user/types/userRole";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../types/objectMetadataKey";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";

// This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
const CanvasObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Canvas",
    persistent: true,
    canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
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
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        return true;
    },
    canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        // Canvas movement must ignore physics
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
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