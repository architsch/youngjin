import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import ObjectMetadataEntryMap from "../maps/objectMetadataEntryMap";
import AddObjectSignal from "../types/addObjectSignal";
import WallAttachedObjectUtil from "./wallAttachedObjectUtil";
import PhysicsManager from "../../physics/physicsManager";
import ObjectTransformUpdateResult from "../types/objectTransformUpdateResult";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import RemoveObjectSignal from "../types/removeObjectSignal";
import User from "../../user/types/user";
import { UserRole } from "../../user/types/userRole";
import SetObjectTransformSignal from "../types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../types/setObjectMetadataSignal";

const ObjectUpdateUtil =
{
    canAddObject(user: User, userRole: UserRole, room: Room, obj: AddObjectSignal): boolean
    {
        // Check if the object's ID is absent.
        if (!obj.objectId || obj.objectId.length == 0)
            return false;

        // Check if the room doesn't match.
        if (obj.roomID != room.id)
            return false;

        // Check if the object already exists.
        if (obj.objectId && room.objectById[obj.objectId])
            return false;

        // Check if the object passes the config's criteria.
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserAddObject(user, userRole, room, obj))
            return false;

        // Check if the object's collider is placeable.
        const colliderState = PhysicsCollisionUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        if (colliderState && colliderState.colliderConfig.colliderType == "wallAttachment")
            return WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        else
            return true;
    },
    addObject(user: User, userRole: UserRole, room: Room, obj: AddObjectSignal,
        validate: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canAddObject(user, userRole, room, obj))
        {
            console.error(`ObjectUpdateUtil::addObject :: Failed (x=${obj.transform.pos.x}, y=${obj.transform.pos.y}, z=${obj.transform.pos.z})`);
            return false;
        }
        // Add the object.
        room.objectById[obj.objectId] = obj;

        // Add the object's corresponding PhysicsObject.
        const colliderState = PhysicsCollisionUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        if (colliderState)
            PhysicsManager.addObject(room.id, obj.objectId, obj.objectTypeIndex, colliderState);

        markRoomAsDirtyIfPersistent(room, obj);
        return true;
    },

    canRemoveObject(user: User, userRole: UserRole, room: Room, signal: RemoveObjectSignal): boolean
    {
        // Check if the room doesn't match.
        if (signal.roomID != room.id)
            return false;

        // Check if the object doesn't exist.
        const obj = room.objectById[signal.objectId];
        if (obj == undefined)
            return false;
        
        // Check if the object passes the config's criteria.
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserRemoveObject(user, userRole, room, obj))
            return false;

        return true;
    },
    removeObject(user: User, userRole: UserRole, room: Room, signal: RemoveObjectSignal,
        validate: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canRemoveObject(user, userRole, room, signal))
        {
            console.error(`ObjectUpdateUtil::removeObject :: Failed (objectId=${signal.objectId})`);
            return false;
        }
        // Remove the object.
        const obj = room.objectById[signal.objectId];
        delete room.objectById[signal.objectId];

        // Remove the object's corresponding PhysicsObject.
        if (PhysicsManager.hasObject(room.id, signal.objectId))
            PhysicsManager.removeObject(room.id, signal.objectId);

        markRoomAsDirtyIfPersistent(room, obj);
        return true;
    },

    canSetObjectTransform(user: User, userRole: UserRole, room: Room,
        signal: SetObjectTransformSignal): boolean
    {
        // Check if the object doesn't exist.
        const obj = room.objectById[signal.objectId];
        if (obj == undefined)
            return false;

        // Check if the object passes the config's criteria.
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserSetObjectTransform(user, userRole, room, obj, signal))
            return false;

        // Check if the object's collider is placeable.
        const colliderState = PhysicsCollisionUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        if (colliderState && colliderState.colliderConfig.colliderType == "wallAttachment")
            return WallAttachedObjectUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        else
            return true;
    },
    setObjectTransform(user: User, userRole: UserRole, room: Room, signal: SetObjectTransformSignal,
        validate: boolean = true): ObjectTransformUpdateResult
    {
        const obj = room.objectById[signal.objectId];
        if (validate && !ObjectUpdateUtil.canSetObjectTransform(user, userRole, room, signal))
        {
            console.error(`ObjectUpdateUtil::setObjectTransform :: Failed (x=${signal.transform.pos.x}, y=${signal.transform.pos.y}, z=${signal.transform.pos.z})`);
            return {transform: obj.transform, desyncDetected: true};
        }
        markRoomAsDirtyIfPersistent(room, obj);

        // Set the transform.
        if (PhysicsManager.hasObject(room.id, signal.objectId))
        {
            const result = PhysicsManager.setObjectTransform(room.id, signal.objectId,
                obj.objectTypeIndex, signal.transform.pos, signal.transform.dir, signal.ignorePhysics);
            obj.transform.pos.x = result.transform.pos.x;
            obj.transform.pos.y = result.transform.pos.y;
            obj.transform.pos.z = result.transform.pos.z;
            obj.transform.dir.x = result.transform.dir.x;
            obj.transform.dir.y = result.transform.dir.y;
            obj.transform.dir.z = result.transform.dir.z;
            return result;
        }
        else
        {
            obj.transform.pos.x = signal.transform.pos.x;
            obj.transform.pos.y = signal.transform.pos.y;
            obj.transform.pos.z = signal.transform.pos.z;
            obj.transform.dir.x = signal.transform.dir.x;
            obj.transform.dir.y = signal.transform.dir.y;
            obj.transform.dir.z = signal.transform.dir.z;
            return {transform: signal.transform, desyncDetected: false};
        }
    },

    canSetObjectMetadata(user: User, userRole: UserRole, room: Room,
        signal: SetObjectMetadataSignal): boolean
    {
        // Check if the room doesn't match.
        if (signal.roomID != room.id)
            return false;

        // Check if the object doesn't exist.
        const obj = room.objectById[signal.objectId];
        if (obj == undefined)
            return false;

        // Check if the object passes the config's criteria.
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserSetObjectMetadata(user, userRole, room, obj, signal))
            return false;

        return true;
    },
    setObjectMetadata(user: User, userRole: UserRole, room: Room,
        signal: SetObjectMetadataSignal, validate: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canSetObjectMetadata(user, userRole, room, signal))
        {
            console.error(`ObjectUpdateUtil::setObjectMetadata :: Failed (objectId=${signal.objectId})`);
            return false;
        }
        // Set the metadata.
        const obj = room.objectById[signal.objectId];
        obj.metadata[signal.metadataKey] = new EncodableByteString(
            ObjectMetadataEntryMap.preprocess(signal.metadataKey, signal.metadataValue));
        
        markRoomAsDirtyIfPersistent(room, obj);
        return true;
    },
}

function markRoomAsDirtyIfPersistent(room: Room, obj: AddObjectSignal): void
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    if (config.persistent)
        room.dirty = true;
}

export default ObjectUpdateUtil;