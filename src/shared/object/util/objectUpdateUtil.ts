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
import { COLLISION_LAYER_MIN, COLLISION_LAYER_MAX } from "../../system/sharedConstants";
import Vector3DUtil from "../../math/util/vector3DUtil";
import DirUtil from "../../math/util/dirUtil";

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

    canMoveObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): boolean
    {
        const obj = room.objectById[objectId];
        if (!obj)
            return false;
        return getMoveResult(room, obj, dx, dy, dz) != undefined;
    },
    moveObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): ObjectSpawnParams | null
    {
        if (!ObjectUpdateUtil.canMoveObject(room, objectId, dx, dy, dz))
        {
            console.error(`ObjectUpdateUtil.moveObject :: Failed (objectId=${objectId}, dx=${dx}, dy=${dy}, dz=${dz})`);
            return null;
        }
        const obj = room.objectById[objectId];
        const result = getMoveResult(room, obj, dx, dy, dz)!;

        obj.transform.x = result.newPos.x;
        obj.transform.y = result.newPos.y;
        obj.transform.z = result.newPos.z;

        obj.transform.dirX = result.newDir.x;
        obj.transform.dirY = result.newDir.y;
        obj.transform.dirZ = result.newDir.z;
        return obj;
    },

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

function getMoveResult(room: Room, obj: ObjectSpawnParams,
    dx: number, dy: number, dz: number): {newPos: Vec3, newDir: Vec3} | undefined
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    if (config.tags.includes(ObjectTagEnumMap.AttachedToWall)) // wall-attached object
    {
        if (dz != 0)
            throw new Error(`Change in z-coordinate is not allowed in a wall-attached object.`);
        else if (dx != 0 && dy == 0) // For a wall-attached object, the "dx" value is interpreted as a movement along its 'local' x-axis (NOT the global x-axis).
            return getHorizontalMoveResult(room, obj, dx > 0);
        else if (dx == 0 && dy != 0)
            return getVerticalMoveResult(room, obj, dy > 0);
        throw new Error(`Diagonal movement (dx != 0 && dy != 0) or zero movement (dx == 0 && dy == 0) is not allowed in a wall-attached object.`);
    }
    else // standalone object
    {
        const newPos = {x: obj.transform.x + dx, y: obj.transform.y + dy, z: obj.transform.z + dz};
        const newDir = { x: obj.transform.dirX, y: obj.transform.dirY, z: obj.transform.dirZ };

        if (canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
            return {newPos, newDir};
        return undefined;
    }
}

function getVerticalMoveResult(room: Room, obj: ObjectSpawnParams,
    moveUp: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const pos = {x: obj.transform.x, y: obj.transform.y, z: obj.transform.z};
    const dir = {x: obj.transform.dirX, y: obj.transform.dirY, z: obj.transform.dirZ};

    const newPos = {x: pos.x, y: pos.y + (moveUp ? 0.5 : -0.5), z: pos.z};
    const newDir = dir;

    if (canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
    return undefined;
}

function getHorizontalMoveResult(room: Room, obj: ObjectSpawnParams,
    moveRight: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    let result: {newPos: Vec3, newDir: Vec3} | undefined;
    // Try concave wrap first.
    result = getCornerWrappedHorizontalMoveResult(room, obj, moveRight, true);
    if (result)
        return result;
    // If failed, try straight move next.
    result = getStraightHorizontalMoveResult(room, obj, moveRight);
    if (result)
        return result;
    // If failed, try convex wrap next.
    return getCornerWrappedHorizontalMoveResult(room, obj, moveRight, false);
}

function getStraightHorizontalMoveResult(room: Room, obj: ObjectSpawnParams,
    moveRight: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const pos = {x: obj.transform.x, y: obj.transform.y, z: obj.transform.z};
    const dir = {x: obj.transform.dirX, y: obj.transform.dirY, z: obj.transform.dirZ};

    const dir4 = DirUtil.vec3ToDir4(dir);
    const dir4CCW = DirUtil.rotateCCW(dir4);
    const dirCCW = DirUtil.dir4ToVec3(dir4CCW);

    const offset = Vector3DUtil.scale(dirCCW, moveRight ? 0.5 : -0.5);
    const newPos = Vector3DUtil.add(pos, offset);
    const newDir = dir;

    if (canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
    return undefined;
}

function getCornerWrappedHorizontalMoveResult(room: Room, obj: ObjectSpawnParams,
    moveRight: boolean, tryConcaveWrap: boolean): {newPos: Vec3, newDir: Vec3} | undefined
{
    const pos = {x: obj.transform.x, y: obj.transform.y, z: obj.transform.z};
    const dir = {x: obj.transform.dirX, y: obj.transform.dirY, z: obj.transform.dirZ};

    const dir4 = DirUtil.vec3ToDir4(dir);
    const dir4CCW = DirUtil.rotateCCW(dir4);
    const dirCCW = DirUtil.dir4ToVec3(dir4CCW);

    const colliderState = PhysicsCollisionUtil.getObjectColliderState(obj.objectTypeIndex, pos, dir);
    if (!colliderState)
        throw new Error(`ColliderState not found (objectTypeIndex = ${obj.objectTypeIndex})`);

    const offset1 = Vector3DUtil.scale(dir, (tryConcaveWrap ? 1 : -1) * colliderState.hitbox.halfSizeX);
    const offset2 = Vector3DUtil.scale(dirCCW, (moveRight ? 1 : -1) * colliderState.hitbox.halfSizeX);

    const newPos = Vector3DUtil.add(Vector3DUtil.add(pos, offset1), offset2);
    const newDir = Vector3DUtil.scale(dirCCW, (tryConcaveWrap != moveRight) ? 1 : -1);

    if (canPlaceObject(room, obj.objectId, obj.objectTypeIndex, newPos, newDir))
        return {newPos, newDir};
    return undefined;
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
    // We check voxel occupancy using the object's Y range against collision layers.

    const half = newColliderState.hitbox.halfSizeX;
    const objBottomY = newColliderState.hitbox.y - newColliderState.hitbox.halfSizeY;
    const objTopY = newColliderState.hitbox.y + newColliderState.hitbox.halfSizeY;
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
            if (!voxelCoversYRange(backVoxel.collisionLayerMask, objBottomY, objTopY))
                return false;
            if (!voxelCoversYRange(frontVoxel.collisionLayerMask, objBottomY, objTopY))
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
            if (!voxelCoversYRange(backVoxel.collisionLayerMask, objBottomY, objTopY))
                return false;
            if (!voxelCoversYRange(frontVoxel.collisionLayerMask, objBottomY, objTopY))
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

// Checks whether the voxel's occupied collision layers fully cover the given Y range.
function voxelCoversYRange(collisionLayerMask: number, bottomY: number, topY: number): boolean
{
    const minLayer = Math.max(COLLISION_LAYER_MIN, Math.floor(bottomY * 2));
    const maxLayer = Math.min(COLLISION_LAYER_MAX, Math.floor((topY - 0.001) * 2));
    for (let layer = minLayer; layer <= maxLayer; ++layer)
    {
        if ((collisionLayerMask & (1 << layer)) === 0)
            return false;
    }
    return true;
}

export default ObjectUpdateUtil;