import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MAX_IMAGE_URL_LENGTH, MAX_ROOM_Y } from "../../system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadata } from "../types/objectMetadata";
import PersistentObject from "../types/persistentObject";
import { Dir4 } from "../../math/types/dir4";
import DirUtil from "../../math/util/dirUtil";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import PhysicsManager from "../../physics/physicsManager";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";

//-------------------------------------------------------------------------------------
// Movement Computation (Shared by canMove and move)
//-------------------------------------------------------------------------------------

function computeMovedPosition(room: Room, po: PersistentObject, dx: number, dy: number, dz: number):
    { x: number, y: number, z: number, dir: Dir4 } | null
{
    const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
    let newX = po.x + dx;
    let newY = po.y + dy;
    let newZ = po.z + dz;
    let newDir = po.dir;

    if (config.isWallAttached)
    {
        const { worldDx, worldDz } = DirUtil.localDxToWorldDxDz(po.dir, dx);
        newX = po.x + worldDx;
        newZ = po.z + worldDz;

        if (!isPersistentObjectPositionInBound(newX, newY, newZ) ||
            !isWallAt(room, newX, newY, newZ, po.dir))
        {
            let wrapped = tryCornerWrap(room, po, dx, newY);
            if (!wrapped)
                wrapped = tryCornerWrap(room, po, dx, newY, true);
            if (!wrapped)
                return null;
            newX = wrapped.x;
            newZ = wrapped.z;
            newDir = wrapped.dir;
        }
    }

    if (!isPersistentObjectPositionInBound(newX, newY, newZ))
        return null;

    return { x: newX, y: newY, z: newZ, dir: newDir };
}

//-------------------------------------------------------------------------------------
// CRUD Operations
//-------------------------------------------------------------------------------------

const PersistentObjectUpdateUtil =
{
    canAddPersistentObject(room: Room, objectTypeIndex: number,
        dir: Dir4, x: number, y: number, z: number): boolean
    {
        // In bound?
        if (!isPersistentObjectPositionInBound(x, y, z))
            return false;

        // If the persistentObject has a collider, check collision.
        const colliderInfo = PhysicsCollisionUtil.getColliderInfo(objectTypeIndex, DirUtil.dir4ToVec3(dir), {x, y, z});
        if (colliderInfo)
        {
            const collidingObjectById = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, colliderInfo);
            if (Object.keys(collidingObjectById).length > 0)
                return false;
        }
        return true;
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

        // If the persistentObject has a collider, add its corresponding physicsObject as well.
        const colliderInfo = PhysicsCollisionUtil.getColliderInfo(objectTypeIndex, DirUtil.dir4ToVec3(dir), {x, y, z});
        if (colliderInfo)
        {
            PhysicsManager.addObject(room.id, objectId, y, colliderInfo);
        }
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

        // If the persistentObject has a collider, remove its corresponding physicsObject as well.
        if (PhysicsManager.hasObject(room.id, objectId))
        {
            PhysicsManager.removeObject(room.id, objectId);
        }
        return removed;
    },

    canMovePersistentObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): boolean
    {
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        if (!po)
            return false;

        const result = computeMovedPosition(room, po, dx, dy, dz);
        if (!result)
            return false;

        // If the persistentObject has a collider, check collision.
        const colliderInfo = PhysicsCollisionUtil.getColliderInfo(po.objectTypeIndex,
            DirUtil.dir4ToVec3(result.dir), {x: result.x, y: result.y, z: result.z});
        if (colliderInfo)
        {
            const collidingObjectById = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, colliderInfo);
            for (const collidingObject of Object.values(collidingObjectById))
            {
                if (collidingObject.objectId != objectId)
                    return false;
            }
        }
        return true;
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
        const result = computeMovedPosition(room, po, dx, dy, dz)!;

        po.x = result.x;
        po.y = result.y;
        po.z = result.z;
        po.dir = result.dir;

        // TODO: Notify the client side of this position/direction change by means of a sharedObservable.

        // TODO: Remove ------------------------------------------------
        //const hash = spatialHashByRoomId[room.id];
        //if (hash)
        //    SpatialHash3DUtil.updateEntry(hash, po.objectId, computeAABB3(po.objectTypeIndex, po.dir, po.x, po.y, po.z));

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

    //-------------------------------------------------------------------------------------
    // Block Removal Guard
    //-------------------------------------------------------------------------------------

    // Returns true if removing the voxel block at (row, col, collisionLayer) would cause
    // any wall-attached persistent object to lose its wall support.
    wouldBlockRemovalBreakPersistentObject(
        room: Room, row: number, col: number, collisionLayer: number): boolean
    {
        for (const po of Object.values(room.persistentObjectGroup.persistentObjectById))
        {
            const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
            if (!config.isWallAttached) continue;

            const meshBottomLayer = Math.min(
                Math.max(Math.floor(po.y * 2), COLLISION_LAYER_MIN),
                COLLISION_LAYER_MAX
            );
            const meshTopLayer = Math.min(
                Math.max(Math.floor((po.y + 1) * 2 - 0.001), COLLISION_LAYER_MIN),
                COLLISION_LAYER_MAX
            );
            if (collisionLayer < meshBottomLayer || collisionLayer > meshTopLayer) continue;

            if (doesBlockSupportPersistentObject(po, row, col))
                return true;
        }
        return false;
    },
};

//-------------------------------------------------------------------------------------
// Wall Detection
//-------------------------------------------------------------------------------------

function isWallAt(room: Room, x: number, y: number, z: number, dir: Dir4): boolean
{
    const collisionLayer = Math.min(Math.max(Math.floor(y * 2), COLLISION_LAYER_MIN), COLLISION_LAYER_MAX);
    const {facingAxis, orientation} = DirUtil.dir4ToProperties(dir);

    if (facingAxis == "z")
    {
        const row = (orientation == "+") ? z - 1 : z;
        if (row < 0 || row >= NUM_VOXEL_ROWS) return false;

        const isEdge = (x % 1 === 0);
        if (isEdge)
        {
            const colLeft = x - 1;
            const colRight = x;
            const leftValid = colLeft >= 0 && colLeft < NUM_VOXEL_COLS
                && VoxelQueryUtil.isVoxelQuadVisible(room, row, colLeft, facingAxis, orientation, collisionLayer);
            const rightValid = colRight >= 0 && colRight < NUM_VOXEL_COLS
                && VoxelQueryUtil.isVoxelQuadVisible(room, row, colRight, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const col = Math.floor(x);
            if (col < 0 || col >= NUM_VOXEL_COLS) return false;
            return VoxelQueryUtil.isVoxelQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
    else if (facingAxis == "x")
    {
        const col = (orientation == "+") ? x - 1 : x;
        if (col < 0 || col >= NUM_VOXEL_COLS) return false;

        const isEdge = (z % 1 === 0);
        if (isEdge)
        {
            const rowLeft = z - 1;
            const rowRight = z;
            const leftValid = rowLeft >= 0 && rowLeft < NUM_VOXEL_ROWS
                && VoxelQueryUtil.isVoxelQuadVisible(room, rowLeft, col, facingAxis, orientation, collisionLayer);
            const rightValid = rowRight >= 0 && rowRight < NUM_VOXEL_ROWS
                && VoxelQueryUtil.isVoxelQuadVisible(room, rowRight, col, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const row = Math.floor(z);
            if (row < 0 || row >= NUM_VOXEL_ROWS) return false;
            return VoxelQueryUtil.isVoxelQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
    else
    {
        throw new Error(`Invalid facingAxis :: ${facingAxis}`);
    }
}

//-------------------------------------------------------------------------------------
// Corner Wrapping (Simplified via direction arithmetic + axis decomposition)
//-------------------------------------------------------------------------------------

function tryCornerWrap(room: Room, po: PersistentObject, dx: number, newY: number,
    concave: boolean = false): {x: number, z: number, dir: Dir4} | null
{
    const movingRight = dx > 0;

    // Direction: CW rotation when moving right at convex corner, CCW when left.
    // Concave corners invert the rotation.
    const clockwise = movingRight !== concave;
    const wrapDir = clockwise ? DirUtil.rotateCW(po.dir) : DirUtil.rotateCCW(po.dir);

    // Position: compute from axis decomposition instead of per-direction switch.
    const {facingAxis, orientation} = DirUtil.dir4ToProperties(po.dir);
    const tangent = DirUtil.localDxToWorldDxDz(po.dir, 1);
    const tangentPositive = (tangent.worldDx > 0 || tangent.worldDz > 0);
    const wallOffset = (orientation === "+") ? -1 : 0;
    const cornerOffset = (movingRight === tangentPositive) ? 1 : 0;

    const normalCoord = facingAxis === "z" ? po.z : po.x;
    const tangentCoord = facingAxis === "z" ? po.x : po.z;

    const wallIndex = normalCoord + wallOffset;
    const slidingCell = Math.floor(tangentCoord);

    let newX: number, newZ: number;
    if (facingAxis === "z")
    {
        newX = slidingCell + cornerOffset;
        newZ = wallIndex + 0.5;
    }
    else
    {
        newX = wallIndex + 0.5;
        newZ = slidingCell + cornerOffset;
    }

    if (concave)
    {
        const v = DirUtil.dir4ToVec3(po.dir);
        newX += v.x;
        newZ += v.z;
    }

    if (!isWallAt(room, newX, newY, newZ, wrapDir))
        return null;

    return {x: newX, z: newZ, dir: wrapDir};
}

//-------------------------------------------------------------------------------------
// Block Support Check (Simplified via axis decomposition)
//-------------------------------------------------------------------------------------

function doesBlockSupportPersistentObject(
    po: PersistentObject, blockRow: number, blockCol: number): boolean
{
    const {facingAxis, orientation} = DirUtil.dir4ToProperties(po.dir);
    const wallOffset = (orientation === "+") ? -1 : 0;

    if (facingAxis === "z")
    {
        if (blockRow !== po.z + wallOffset) return false;
        return isBlockInSlidingRange(po.x, blockCol);
    }
    else
    {
        if (blockCol !== po.x + wallOffset) return false;
        return isBlockInSlidingRange(po.z, blockRow);
    }
}

function isBlockInSlidingRange(slidingCoord: number, blockIndex: number): boolean
{
    const meshMin = slidingCoord - 0.5;
    const meshMax = slidingCoord + 0.5;
    return blockIndex < meshMax && (blockIndex + 1) > meshMin;
}

function isPersistentObjectPositionInBound(x: number, y: number, z: number): boolean
{
    return x >= 1 && x <= NUM_VOXEL_COLS-1 &&
        y > 0 && y < MAX_ROOM_Y &&
        z >= 1 && z <= NUM_VOXEL_ROWS-1;
}

export default PersistentObjectUpdateUtil;
