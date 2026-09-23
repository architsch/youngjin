import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import ObjectMetadataEntryMap from "../maps/objectMetadataEntryMap";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectAttachmentUtil from "./objectAttachmentUtil";
import PhysicsManager from "../../physics/physicsManager";
import ObjectTransformUpdateResult from "../types/objectTransformUpdateResult";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import ObjectCategoryConfigMap from "../maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import RemoveObjectSignal from "../types/removeObjectSignal";
import User from "../../user/types/user";
import SetObjectTransformSignal from "../types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../types/setObjectMetadataSignal";
import RestrictedZoneUtil from "../../voxel/util/restrictedZoneUtil";
import ObjectTransform from "../types/objectTransform";
import ObjectScaleUtil from "./objectScaleUtil";

const ObjectUpdateUtil =
{
    canAddObject(user: User, room: Room, obj: AddObjectSignal): boolean
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
        if (!config.canUserAddObject(user, room, obj))
            return false;

        // Check if the room already holds as many of the object's category as it may. The cap belongs to
        // the category, so every type in one spends it together (see ObjectCategoryConfigMap).
        const maxCountPerRoom = ObjectCategoryConfigMap.getConfig(config.category).maxCountPerRoom;
        if (maxCountPerRoom != undefined
            && room.objectGroup.getCategoryCount(config.category) >= maxCountPerRoom)
            return false;

        // Restricted zone check (see @docs/gameplay/restricted_zone.md).
        if (RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform))
            return false;

        // Check if an attached object has a face to rest on.
        if (config.attachment)
            return ObjectAttachmentUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, obj.transform);
        return true;
    },
    addObject(user: User, room: Room, obj: AddObjectSignal,
        validate: boolean = true, addToRoomData: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canAddObject(user, room, obj))
        {
            console.error(`ObjectUpdateUtil::addObject :: Failed (x=${obj.transform.pos.x}, y=${obj.transform.pos.y}, z=${obj.transform.pos.z})`);
            return false;
        }
        // Add the object.
        if (addToRoomData)
        {
            room.objectGroup.addObject(obj);
            markRoomAsDirtyIfPersistent(room, obj);
        }

        // Skip if already registered (room loads bulk-register physics objects before spawning).
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform);
        if (colliderState && !PhysicsManager.hasObject(room.id, obj.objectId))
            PhysicsManager.addObject(room.id, obj.objectId, obj.objectTypeIndex, colliderState);
        return true;
    },

    canRemoveObject(user: User, room: Room, signal: RemoveObjectSignal): boolean
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
        if (!config.canUserRemoveObject(user, room, obj))
            return false;

        // Check if the object stands in a stretch of the room that is not this user's to clear.
        if (RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform))
            return false;

        return true;
    },
    removeObject(user: User, room: Room, signal: RemoveObjectSignal,
        validate: boolean = true, removeFromRoomData: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canRemoveObject(user, room, signal))
        {
            console.error(`ObjectUpdateUtil::removeObject :: Failed (objectId=${signal.objectId})`);
            return false;
        }
        // Remove the object.
        if (removeFromRoomData)
        {
            const obj = room.objectById[signal.objectId];
            room.objectGroup.removeObject(signal.objectId);
            markRoomAsDirtyIfPersistent(room, obj);
        }

        // Remove the object's corresponding PhysicsObject.
        if (PhysicsManager.hasObject(room.id, signal.objectId))
            PhysicsManager.removeObject(room.id, signal.objectId);
        return true;
    },

    canSetObjectTransform(user: User, room: Room,
        signal: SetObjectTransformSignal): boolean
    {
        // Check if the object doesn't exist.
        const obj = room.objectById[signal.objectId];
        if (obj == undefined)
            return false;

        // Check if the object passes the config's criteria.
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserSetObjectTransform(user, room, obj, signal))
            return false;

        const target = ObjectUpdateUtil.getSanitizedTargetTransform(obj, signal);

        // Check both source and destination, or objects could be dragged out of a zone and then removed.
        if (RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform) ||
            RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, target))
            return false;

        // Check that the object is placeable where it is going, at the size it is going to be. The
        // request is the client's, so the destination is what has to hold up, not where it stands now.
        if (config.attachment)
            return ObjectAttachmentUtil.canPlaceObject(room, obj.objectId, obj.objectTypeIndex, target);
        return true;
    },
    // What the signal is allowed to mean: its position and facing, with the scale snapped onto the
    // type's own grid (see ObjectScaleUtil). A scale is never taken as sent — quantization leaves the
    // wire value just below what was written, and nothing else bounds what a client may ask for.
    getSanitizedTargetTransform(obj: AddObjectSignal, signal: SetObjectTransformSignal): ObjectTransform
    {
        return new ObjectTransform(signal.transform.pos, signal.transform.dir,
            ObjectScaleUtil.sanitize(obj.objectTypeIndex, signal.transform.scale));
    },
    setObjectTransform(user: User, room: Room, signal: SetObjectTransformSignal,
        validate: boolean = true): ObjectTransformUpdateResult
    {
        const obj = room.objectById[signal.objectId];
        if (validate && !ObjectUpdateUtil.canSetObjectTransform(user, room, signal))
        {
            console.error(`ObjectUpdateUtil::setObjectTransform :: Failed (x=${signal.transform.pos.x}, y=${signal.transform.pos.y}, z=${signal.transform.pos.z})`);
            return {transform: obj.transform, desyncDetected: true};
        }
        markRoomAsDirtyIfPersistent(room, obj);

        const target = ObjectUpdateUtil.getSanitizedTargetTransform(obj, signal);

        // Set the transform.
        if (PhysicsManager.hasObject(room.id, signal.objectId))
        {
            const result = PhysicsManager.setObjectTransform(room.id, signal.objectId,
                target, signal.ignorePhysics);
            obj.transform.pos.x = result.transform.pos.x;
            obj.transform.pos.y = result.transform.pos.y;
            obj.transform.pos.z = result.transform.pos.z;
            obj.transform.dir.x = result.transform.dir.x;
            obj.transform.dir.y = result.transform.dir.y;
            obj.transform.dir.z = result.transform.dir.z;
            obj.transform.scale.x = result.transform.scale.x;
            obj.transform.scale.y = result.transform.scale.y;
            obj.transform.scale.z = result.transform.scale.z;
            return result;
        }
        else
        {
            obj.transform.pos.x = target.pos.x;
            obj.transform.pos.y = target.pos.y;
            obj.transform.pos.z = target.pos.z;
            obj.transform.dir.x = target.dir.x;
            obj.transform.dir.y = target.dir.y;
            obj.transform.dir.z = target.dir.z;
            obj.transform.scale.x = target.scale.x;
            obj.transform.scale.y = target.scale.y;
            obj.transform.scale.z = target.scale.z;
            return {transform: target, desyncDetected: false};
        }
    },

    canSetObjectMetadata(user: User, room: Room,
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
        if (!config.canUserSetObjectMetadata(user, room, obj, signal))
            return false;

        // Metadata edits are also zone-restricted (a picture's content is part of that stretch of room).
        if (RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform))
            return false;

        return true;
    },
    setObjectMetadata(user: User, room: Room,
        signal: SetObjectMetadataSignal, validate: boolean = true): boolean
    {
        if (validate && !ObjectUpdateUtil.canSetObjectMetadata(user, room, signal))
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