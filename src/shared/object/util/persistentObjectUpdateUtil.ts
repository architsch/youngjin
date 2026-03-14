import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MAX_IMAGE_URL_LENGTH, MAX_ROOM_Y } from "../../system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadata } from "../types/objectMetadata";
import PersistentObject from "../types/persistentObject";
import { Dir4 } from "../../math/types/dir4";
import DirUtil from "../../math/util/dirUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import { ObjectTagEnumMap } from "../types/objectTag";
import Vec3 from "../../math/types/vec3";
import PhysicsObject from "../../physics/types/physicsObject";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import BitmaskUtil from "../../math/util/bitmaskUtil";

const PersistentObjectUpdateUtil =
{
    canAddPersistentObject(room: Room, objectTypeIndex: number,
        dir: Dir4, x: number, y: number, z: number): boolean
    {
        return canPlaceObject(room, "", objectTypeIndex, {x, y, z}, DirUtil.dir4ToVec3(dir));
    },
    addPersistentObject(room: Room, objectId: string, objectTypeIndex: number,
        dir: Dir4, x: number, y: number, z: number,
        metadata: ObjectMetadata = {}): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canAddPersistentObject(room, objectTypeIndex, dir, x, y, z))
        {
            console.error(`PersistentObjectUpdateUtil.addPersistentObject :: Failed (x=${x}, y=${y}, z=${z})`);
            return null;
        }
        const po = new PersistentObject(objectId, objectTypeIndex, dir, x, y, z, metadata);
        room.persistentObjectGroup.persistentObjectById[objectId] = po;
        return po;
    },

    canRemovePersistentObject(room: Room, objectId: string): boolean
    {
        return room.persistentObjectGroup.persistentObjectById[objectId] != undefined;
    },
    removePersistentObject(room: Room, objectId: string): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canRemovePersistentObject(room, objectId))
        {
            console.error(`PersistentObjectUpdateUtil.removePersistentObject :: Failed (objectId=${objectId})`);
            return null;
        }
        const removed = room.persistentObjectGroup.persistentObjectById[objectId];
        delete room.persistentObjectGroup.persistentObjectById[objectId];
        return removed;
    },

    canMovePersistentObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): boolean
    {
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        if (!po)
            return false;
        return getMoveResult(room, po, dx, dy, dz) != undefined;
    },
    movePersistentObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canMovePersistentObject(room, objectId, dx, dy, dz))
        {
            console.error(`PersistentObjectUpdateUtil.movePersistentObject :: Failed (objectId=${objectId}, dx=${dx}, dy=${dy}, dz=${dz})`);
            return null;
        }
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        const result = getMoveResult(room, po, dx, dy, dz)!;
        po.x = result.newPos.x;
        po.y = result.newPos.y;
        po.z = result.newPos.z;
        po.dir = result.newDir;
        return po;
    },

    canSetPersistentObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): boolean
    {
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        if (!po)
            return false;
        if (metadataKey === ObjectMetadataKeyEnumMap.ImageURL
            && metadataValue.length > MAX_IMAGE_URL_LENGTH)
            return false;
        return true;
    },
    setPersistentObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canSetPersistentObjectMetadata(room, objectId, metadataKey, metadataValue))
        {
            console.error(`PersistentObjectUpdateUtil.setPersistentObjectMetadata :: Failed (objectId=${objectId})`);
            return null;
        }
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        po.metadata[metadataKey] = new EncodableByteString(metadataValue);
        return po;
    },
}

function getMoveResult(room: Room, po: PersistentObject,
    dx: number, dy: number, dz: number): {newPos: Vec3, newDir: Dir4} | undefined
{
    const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
    if (config.tags.includes(ObjectTagEnumMap.AttachedToWall)) // wall-attached object
    {
        if (dz != 0)
            throw new Error(`Change in z-coordinate is not allowed in a wall-attached object.`);
        else if (dx != 0 && dy == 0)
            return getHorizontalMoveResult(room, po, dx > 0);
        else if (dx == 0 && dy != 0)
            return getVerticalMoveResult(room, po, dy > 0);
        throw new Error(`Diagonal movement (dx != 0 && dy != 0) or zero movement (dx == 0 && dy == 0) is not allowed in a wall-attached object.`);
    }
    else // standalone object
    {
        const pos = {x: po.x, y: po.y, z: po.z};
        const newPos = {x: pos.x + dx, y: pos.y + dy, z: pos.z + dz};
        const newDirVec = DirUtil.dir4ToVec3(po.dir);
        const newDir = po.dir;

        if (canPlaceObject(room, po.objectId, po.objectTypeIndex, newPos, newDirVec))
            return {newPos, newDir};
        return undefined;
    }
}

function getVerticalMoveResult(room: Room, po: PersistentObject,
    moveUp: boolean): {newPos: Vec3, newDir: Dir4} | undefined
{
    const pos = {x: po.x, y: po.y, z: po.z};
    const newPos = {x: pos.x, y: pos.y + (moveUp ? 0.5 : -0.5), z: pos.z};
    const newDirVec = DirUtil.dir4ToVec3(po.dir);
    const newDir = po.dir;

    if (canPlaceObject(room, po.objectId, po.objectTypeIndex, newPos, newDirVec))
        return {newPos, newDir};
    return undefined;
}

function getHorizontalMoveResult(room: Room, po: PersistentObject,
    moveRight: boolean): {newPos: Vec3, newDir: Dir4} | undefined
{
    let result: {newPos: Vec3, newDir: Dir4} | undefined;
    // Try concave wrap first.
    result = getCornerWrappedHorizontalMoveResult(room, po, moveRight, true);
    if (result)
        return result;
    // If failed, try straight move next.
    result = getStraightHorizontalMoveResult(room, po, moveRight);
    if (result)
        return result;
    // If failed, try convex wrap next.
    return getCornerWrappedHorizontalMoveResult(room, po, moveRight, false);
}

function getStraightHorizontalMoveResult(room: Room, po: PersistentObject,
    moveRight: boolean): {newPos: Vec3, newDir: Dir4} | undefined
{
    const pos = {x: po.x, y: po.y, z: po.z};

    const dirCCW = DirUtil.rotateCCW(po.dir);
    const dirVecCCW = DirUtil.dir4ToVec3(dirCCW);

    const offset = Vector3DUtil.scale(dirVecCCW, moveRight ? 0.5 : -0.5);
    const newPos = Vector3DUtil.add(pos, offset);
    const newDirVec = DirUtil.dir4ToVec3(po.dir);
    const newDir = po.dir;

    if (canPlaceObject(room, po.objectId, po.objectTypeIndex, newPos, newDirVec))
        return {newPos, newDir};
    return undefined;
}

function getCornerWrappedHorizontalMoveResult(room: Room, po: PersistentObject,
    moveRight: boolean, tryConcaveWrap: boolean): {newPos: Vec3, newDir: Dir4} | undefined
{
    const pos = {x: po.x, y: po.y, z: po.z};

    const dirVec = DirUtil.dir4ToVec3(po.dir);
    const dirCCW = DirUtil.rotateCCW(po.dir);
    const dirVecCCW = DirUtil.dir4ToVec3(dirCCW);

    const colliderState = PhysicsCollisionUtil.getObjectColliderState(po.objectTypeIndex, pos, dirVec);
    if (!colliderState)
        throw new Error(`ColliderState not found (objectTypeIndex = ${po.objectTypeIndex})`);

    const offset1 = Vector3DUtil.scale(dirVec, (tryConcaveWrap ? 1 : -1) * colliderState.hitbox.halfSizeX);
    const offset2 = Vector3DUtil.scale(dirVecCCW, (moveRight ? 1 : -1) * colliderState.hitbox.halfSizeX);

    const newPos = Vector3DUtil.add(Vector3DUtil.add(pos, offset1), offset2);
    const newDirVec = Vector3DUtil.scale(dirVecCCW, (tryConcaveWrap != moveRight) ? 1 : -1);
    const newDir = DirUtil.vec3ToDir4(newDirVec);

    if (canPlaceObject(room, po.objectId, po.objectTypeIndex, newPos, newDirVec))
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
    
    const half = newColliderState.hitbox.halfSizeX;
    const newDir = DirUtil.vec3ToDir4(newDirVec);
    const objectMask = newColliderState.collisionLayerMask;
    let frontExposureFound = false;

    if (newDir == "+z" || newDir == "-z") // object is a horizontal line on the XZ plane (X = horizontal, Z = vertical)
    {
        const backRow = Math.floor(newPos.z + 0.01 * (newDir == "+z" ? -1 : +1)); // apply a small backward offset is to scan voxels behind
        const frontRow = Math.floor(newPos.z + 0.01 * (newDir == "+z" ? +1 : -1)); // apply a small forward offset to scan voxels in front
        const leftCol = Math.floor(newPos.x - half);
        const rightCol = Math.floor(newPos.x + half);
        for (let col = leftCol; col <= rightCol; ++col)
        {
            const backVoxel = VoxelQueryUtil.getVoxel(room, backRow, col);
            const frontVoxel = VoxelQueryUtil.getVoxel(room, frontRow, col);
            const backVoxelMask = backVoxel.collisionLayerMask;
            const frontVoxelMask = frontVoxel.collisionLayerMask;

            if (!BitmaskUtil.isSubsetOf(objectMask, backVoxelMask)) // (1) The object's back side must be fully covered (by voxel blocks).
                return false;
            if (!BitmaskUtil.isSubsetOf(objectMask, frontVoxelMask)) // (2) The object's front side must be at least partially exposed.
                frontExposureFound = true;
        }
    }
    else // object is a vertical line on the XZ plane (X = horizontal, Z = vertical)
    {
        const backCol = Math.floor(newPos.x + 0.01 * (newDir == "+x" ? -1 : +1)); // apply a small backward offset is to scan voxels behind
        const frontCol = Math.floor(newPos.x + 0.01 * (newDir == "+x" ? +1 : -1)); // apply a small forward offset to scan voxels in front
        const leftRow = Math.floor(newPos.z - half);
        const rightRow = Math.floor(newPos.z + half);
        for (let row = leftRow; row <= rightRow; ++row)
        {
            const backVoxel = VoxelQueryUtil.getVoxel(room, row, backCol);
            const frontVoxel = VoxelQueryUtil.getVoxel(room, row, frontCol);
            const backVoxelMask = backVoxel.collisionLayerMask;
            const frontVoxelMask = frontVoxel.collisionLayerMask;

            if (!BitmaskUtil.isSubsetOf(objectMask, backVoxelMask)) // (1) The object's back side must be fully covered (by voxel blocks).
                return false;
            if (!BitmaskUtil.isSubsetOf(objectMask, frontVoxelMask)) // (2) The object's front side must be at least partially exposed.
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

export default PersistentObjectUpdateUtil;
