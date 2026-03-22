import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import ObjectMetadataEntryMap from "../maps/objectMetadataEntryMap";
import { ObjectMetadata } from "../types/objectMetadata";
import AddObjectSignal from "../types/addObjectSignal";
import ObjectTransform from "../types/objectTransform";
import Vec3 from "../../math/types/vec3";
import WallAttachedObjectUtil from "./wallAttachedObjectUtil";
import PhysicsManager from "../../physics/physicsManager";
import ObjectTransformUpdateResult from "../types/objectTransformUpdateResult";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";

const ObjectUpdateUtil =
{
    canAddObject(room: Room, objectTypeIndex: number,
        pos: Vec3, dir: Vec3, objectId?: string): boolean
    {
        if (objectId && room.objectById[objectId]) // Already added
            return false;
        const colliderState = PhysicsCollisionUtil.getObjectColliderState(objectTypeIndex, pos, dir);
        if (colliderState && colliderState.colliderConfig.colliderType == "wallAttachment") // wall-attached object
            return WallAttachedObjectUtil.canPlaceObject(room, "", objectTypeIndex, pos, dir);
        return true;
    },
    addObject(room: Room, objectId: string, objectTypeIndex: number,
        pos: Vec3, dir: Vec3,
        metadata: ObjectMetadata = {}, sourceUserID: string = "", sourceUserName: string = ""): AddObjectSignal | null
    {
        if (!ObjectUpdateUtil.canAddObject(room, objectTypeIndex, pos, dir))
        {
            console.error(`ObjectUpdateUtil.addObject :: Failed (x=${pos.x}, y=${pos.y}, z=${pos.z})`);
            return null;
        }
        const obj = new AddObjectSignal(room.id, sourceUserID, sourceUserName,
            objectTypeIndex, objectId, new ObjectTransform({...pos}, {...dir}), metadata);
        room.objectById[objectId] = obj;
        return obj;
    },

    canRemoveObject(room: Room, objectId: string): boolean
    {
        return room.objectById[objectId] != undefined;
    },
    removeObject(room: Room, objectId: string): AddObjectSignal | null
    {
        if (!ObjectUpdateUtil.canRemoveObject(room, objectId))
        {
            console.error(`ObjectUpdateUtil.removeObject :: Failed (objectId=${objectId})`);
            return null;
        }
        const removed = room.objectById[objectId];
        delete room.objectById[objectId];
        return removed;
    },

    canSetObjectTransform(room: Room, objectId: string, pos: Vec3, dir: Vec3): boolean
    {
        const objectTypeIndex = room.objectById[objectId].objectTypeIndex;
        const colliderState = PhysicsCollisionUtil.getObjectColliderState(objectTypeIndex, pos, dir);
        if (colliderState && colliderState.colliderConfig.colliderType == "wallAttachment") // wall-attached object
            return WallAttachedObjectUtil.canPlaceObject(room, objectId, objectTypeIndex, pos, dir);
        return true;
    },
    setObjectTransform(room: Room, objectId: string, pos: Vec3, dir: Vec3,
        ignorePhysics: boolean): ObjectTransformUpdateResult
    {
        const obj = room.objectById[objectId];
        if (!ObjectUpdateUtil.canSetObjectTransform(room, objectId, pos, dir))
        {
            console.error(`ObjectUpdateUtil.setObjectTransform :: Failed (x=${pos.x}, y=${pos.y}, z=${pos.z})`);
            return {transform: obj.transform, desyncDetected: false};
        }
        const result = PhysicsManager.setObjectTransform(room.id, objectId,
            obj.objectTypeIndex, pos, dir, ignorePhysics);
        obj.transform.pos.x = result.transform.pos.x;
        obj.transform.pos.y = result.transform.pos.y;
        obj.transform.pos.z = result.transform.pos.z;
        obj.transform.dir.x = result.transform.dir.x;
        obj.transform.dir.y = result.transform.dir.y;
        obj.transform.dir.z = result.transform.dir.z;
        return result;
    },

    canSetObjectMetadata(room: Room, objectId: string): boolean
    {
        const obj = room.objectById[objectId];
        if (!obj)
            return false;
        return true;
    },
    setObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): AddObjectSignal | null
    {
        if (!ObjectUpdateUtil.canSetObjectMetadata(room, objectId))
        {
            console.error(`ObjectUpdateUtil.setObjectMetadata :: Failed (objectId=${objectId})`);
            return null;
        }
        const obj = room.objectById[objectId];
        obj.metadata[metadataKey] = new EncodableByteString(ObjectMetadataEntryMap.preprocess(metadataKey, metadataValue));
        return obj;
    },
}

export default ObjectUpdateUtil;