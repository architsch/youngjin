import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MAX_IMAGE_URL_LENGTH, MAX_ROOM_Y } from "../../system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadata } from "../types/objectMetadata";
import ObjectSpawnParams from "../types/objectSpawnParams";
import ObjectTransform from "../types/objectTransform";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import { ObjectTagEnumMap } from "../types/objectTag";
import Vec3 from "../../math/types/vec3";
import PhysicsObject from "../../physics/types/physicsObject";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import BitmaskUtil from "../../math/util/bitmaskUtil";

const ObjectUpdateUtil =
{
    canAddObject(room: Room, objectTypeIndex: number,
        x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number): boolean
    {
        return canPlaceObject(room, "", objectTypeIndex, {x, y, z}, {x: dirX, y: dirY, z: dirZ});
    },
    addObject(room: Room, objectId: string, objectTypeIndex: number,
        x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number,
        metadata: ObjectMetadata = {}, sourceUserID: string = "", sourceUserName: string = ""): ObjectSpawnParams | null
    {
        if (!ObjectUpdateUtil.canAddObject(room, objectTypeIndex, x, y, z, dirX, dirY, dirZ))
        {
            console.error(`ObjectUpdateUtil.addObject :: Failed (x=${x}, y=${y}, z=${z})`);
            return null;
        }
        const obj = new ObjectSpawnParams(room.id, sourceUserID, sourceUserName,
            objectTypeIndex, objectId, new ObjectTransform(x, y, z, dirX, dirY, dirZ), metadata);
        room.objectById[objectId] = obj;
        return obj;
    },

    canRemoveObject(room: Room, objectId: string): boolean
    {
        return room.objectById[objectId] != undefined;
    },
    removeObject(room: Room, objectId: string): ObjectSpawnParams | null
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

    // TODO: Movement logic will be refactored later.
    // canMoveObject and moveObject are left as stubs for now.

    canSetObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): boolean
    {
        const obj = room.objectById[objectId];
        if (!obj)
            return false;
        if (metadataKey === ObjectMetadataKeyEnumMap.ImageURL
            && metadataValue.length > MAX_IMAGE_URL_LENGTH)
            return false;
        return true;
    },
    setObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): ObjectSpawnParams | null
    {
        if (!ObjectUpdateUtil.canSetObjectMetadata(room, objectId, metadataKey, metadataValue))
        {
            console.error(`ObjectUpdateUtil.setObjectMetadata :: Failed (objectId=${objectId})`);
            return null;
        }
        const obj = room.objectById[objectId];
        obj.metadata[metadataKey] = new EncodableByteString(metadataValue);
        return obj;
    },
}

const standaloneObjBlockingCond = (myObjectId: string, collidingObject: PhysicsObject) => {
    return collidingObject.objectId != myObjectId;
};

const wallAttachedObjBlockingCond = (myObjectId: string, collidingObject: PhysicsObject) => {
    const config = ObjectTypeConfigMap.getConfigByIndex(collidingObject.objectTypeIndex);
    return collidingObject.objectId != myObjectId && config.tags.includes(ObjectTagEnumMap.AttachedToWall);
};

function canPlaceObject(room: Room, objectId: string, objectTypeIndex: number,
    newPos: Vec3, newDirVec: Vec3): boolean
{
    // Object's center position must not be out of the room's boundaries.

    if (newPos.x < 1 || newPos.x > NUM_VOXEL_COLS-1 ||
        newPos.y <= 0 || newPos.y >= MAX_ROOM_Y ||
        newPos.z < 1 || newPos.z > NUM_VOXEL_ROWS-1)
    {
        return false;
    }
    const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
    const wallAttached = config.tags.includes(ObjectTagEnumMap.AttachedToWall);

    const newColliderState = PhysicsCollisionUtil.getObjectColliderState(objectTypeIndex, newPos, newDirVec);
    if (!newColliderState)
        throw new Error(`new ColliderState not found (objectTypeIndex = ${objectTypeIndex})`);

    // (1) The object's back side must be fully covered (by voxel blocks).
    // (2) The object's front side must be at least partially exposed.

    const half = newColliderState.hitbox.halfSizeX;
    const objectMask = newColliderState.collisionLayerMask;
    let frontExposureFound = false;

    // Determine which direction the object faces for back/front scanning
    const absX = Math.abs(newDirVec.x);
    const absZ = Math.abs(newDirVec.z);
    const primaryAxis = absZ >= absX ? "z" : "x";

    if (primaryAxis == "z") // object is a horizontal line on the XZ plane (X = horizontal, Z = vertical)
    {
        const backRow = Math.floor(newPos.z + 0.01 * (newDirVec.z > 0 ? -1 : +1));
        const frontRow = Math.floor(newPos.z + 0.01 * (newDirVec.z > 0 ? +1 : -1));
        const leftCol = Math.floor(newPos.x - half);
        const rightCol = Math.floor(newPos.x + half);
        for (let col = leftCol; col <= rightCol; ++col)
        {
            const backVoxel = VoxelQueryUtil.getVoxel(room, backRow, col);
            const frontVoxel = VoxelQueryUtil.getVoxel(room, frontRow, col);
            const backVoxelMask = backVoxel.collisionLayerMask;
            const frontVoxelMask = frontVoxel.collisionLayerMask;

            if (!BitmaskUtil.isSubsetOf(objectMask, backVoxelMask))
                return false;
            if (!BitmaskUtil.isSubsetOf(objectMask, frontVoxelMask))
                frontExposureFound = true;
        }
    }
    else // object is a vertical line on the XZ plane (X = horizontal, Z = vertical)
    {
        const backCol = Math.floor(newPos.x + 0.01 * (newDirVec.x > 0 ? -1 : +1));
        const frontCol = Math.floor(newPos.x + 0.01 * (newDirVec.x > 0 ? +1 : -1));
        const leftRow = Math.floor(newPos.z - half);
        const rightRow = Math.floor(newPos.z + half);
        for (let row = leftRow; row <= rightRow; ++row)
        {
            const backVoxel = VoxelQueryUtil.getVoxel(room, row, backCol);
            const frontVoxel = VoxelQueryUtil.getVoxel(room, row, frontCol);
            const backVoxelMask = backVoxel.collisionLayerMask;
            const frontVoxelMask = frontVoxel.collisionLayerMask;

            if (!BitmaskUtil.isSubsetOf(objectMask, backVoxelMask))
                return false;
            if (!BitmaskUtil.isSubsetOf(objectMask, frontVoxelMask))
                frontExposureFound = true;
        }
    }
    if (!frontExposureFound)
        return false;

    // The new object must not collide with any of the existing wall-attached objects.

    const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, newColliderState);
    for (const collidingObject of Object.values(collidingObjects))
    {
        if (wallAttached
            ? wallAttachedObjBlockingCond(objectId, collidingObject)
            : standaloneObjBlockingCond(objectId, collidingObject))
        {
            return false;
        }
    }
    return true;
}

export default ObjectUpdateUtil;
