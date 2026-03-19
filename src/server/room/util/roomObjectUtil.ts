import ObjectDespawnParams from "../../../shared/object/types/objectDespawnParams";
import ObjectMetadataSetParams from "../../../shared/object/types/objectMetadataSetParams";
import ObjectMoveParams from "../../../shared/object/types/objectMoveParams";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { MAX_CANVASES_PER_ROOM } from "../../../shared/system/sharedConstants";
import { UserRoleEnumMap } from "../../../shared/user/types/userRole";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import { getUserRole } from "./roomUserUtil";

let serverObjectIdCounter = 0;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

function canUserModifyObject(userID: string, obj: ObjectSpawnParams): boolean
{
    if (obj.sourceUserID === userID)
        return true;
    const role = getUserRole(userID);
    if (role === UserRoleEnumMap.Owner || role === UserRoleEnumMap.Editor)
        return true;
    const roomID = RoomManager.currentRoomIDByUserID[userID];
    if (roomID)
    {
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory && roomRuntimeMemory.room.roomType === RoomTypeEnumMap.Hub)
            return true;
    }
    return false;
}

function markDirtyIfPersistent(obj: ObjectSpawnParams, roomID: string): void
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    if (config.persistent)
    {
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory)
            roomRuntimeMemory.room.dirty = true;
    }
}

export function generateObjectId(): string
{
    return `s${++serverObjectIdCounter}`;
}

export function addObject(socketUserContext: SocketUserContext, objectSpawnParams: ObjectSpawnParams)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    const objectId = objectSpawnParams.objectId;

    console.log(`RoomManager.addObject :: roomID = ${roomID}, userID = ${user.id}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.addObject :: RoomID not found (userID = ${user.id}, objectId = ${objectId})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.addObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    if (roomRuntimeMemory.room.objectById[objectId] != undefined)
    {
        console.error(`RoomManager.addObject :: Object already exists (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    roomRuntimeMemory.room.objectById[objectId] = objectSpawnParams;

    const colliderState = objectSpawnParams.getObjectColliderState();
    if (colliderState)
        PhysicsManager.addObject(roomID, objectId, objectSpawnParams.objectTypeIndex, colliderState);

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectSpawnParams", objectSpawnParams, user.id);
}

export function removeObject(socketUserContext: SocketUserContext, objectId: string)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    console.log(`RoomManager.removeObject :: roomID = ${roomID}, userID = ${user.id}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.removeObject :: RoomID not found (userID = ${user.id}, objectId = ${objectId})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    const objectSpawnParams = roomRuntimeMemory.room.objectById[objectId];
    if (objectSpawnParams == undefined)
    {
        console.error(`RoomManager.removeObject :: Object doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    delete roomRuntimeMemory.room.objectById[objectId];

    const colliderState = objectSpawnParams.getObjectColliderState();
    if (colliderState)
        PhysicsManager.removeObject(roomID, objectId);

    const despawnParams = new ObjectDespawnParams(roomID, objectId);

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectDespawnParams", despawnParams, user.id);
}

// Handle client-sent objectSpawnParams (e.g. adding a canvas)
export function handleObjectSpawn(socketUserContext: SocketUserContext, params: ObjectSpawnParams)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    if (!roomID)
    {
        console.error(`RoomManager.handleObjectSpawn :: RoomID not found (userID = ${user.id})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (!roomRuntimeMemory)
    {
        console.error(`RoomManager.handleObjectSpawn :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const room = roomRuntimeMemory.room;

    if (!canUserModifyObject(user.id, params))
    {
        console.warn(`(RoomObjectUtil) Rejected objectSpawnParams from unauthorized user (userID = ${user.id})`);
        return;
    }

    // Validate canvas limit
    if (params.objectTypeIndex === canvasTypeIndex)
    {
        const canvasCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === canvasTypeIndex).length;
        if (canvasCount >= MAX_CANVASES_PER_ROOM)
        {
            console.error(`handleObjectSpawn :: Canvas limit reached (${MAX_CANVASES_PER_ROOM}) in room ${room.id}`);
            socketUserContext.addPendingSignalToUser("objectDespawnParams",
                new ObjectDespawnParams(room.id, params.objectId));
            return;
        }
    }

    // Verify client's objectId matches expected server-side objectId
    const expectedObjectId = `p${room.lastObjectId + 1}`;
    if (params.objectId !== expectedObjectId)
    {
        console.error(`handleObjectSpawn :: ObjectId mismatch (expected=${expectedObjectId}, received=${params.objectId})`);
        socketUserContext.addPendingSignalToUser("objectDespawnParams",
            new ObjectDespawnParams(room.id, params.objectId));
        return;
    }

    // Validate placement
    const t = params.transform;
    if (!ObjectUpdateUtil.canAddObject(room, params.objectTypeIndex, t.pos, t.dir))
    {
        console.error(`handleObjectSpawn :: Placement validation failed (objectId=${params.objectId})`);
        socketUserContext.addPendingSignalToUser("objectDespawnParams",
            new ObjectDespawnParams(room.id, params.objectId));
        return;
    }

    // Add the object
    room.objectById[params.objectId] = params;
    ++room.lastObjectId;

    // Register physics
    const colliderState = params.getObjectColliderState();
    if (colliderState)
        PhysicsManager.addObject(room.id, params.objectId, params.objectTypeIndex, colliderState);

    markDirtyIfPersistent(params, roomID);

    // Broadcast to other clients
    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (socketRoomContext)
        socketRoomContext.multicastSignal("objectSpawnParams", params, user.id);
}

// Handle client-sent objectDespawnParams (e.g. removing a canvas)
export function handleObjectDespawn(socketUserContext: SocketUserContext, params: ObjectDespawnParams)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    if (!roomID)
    {
        console.error(`RoomManager.handleObjectDespawn :: RoomID not found (userID = ${user.id})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (!roomRuntimeMemory)
    {
        console.error(`RoomManager.handleObjectDespawn :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const room = roomRuntimeMemory.room;
    const existingObj = room.objectById[params.objectId];
    if (!existingObj)
    {
        console.error(`RoomManager.handleObjectDespawn :: Object not found (objectId = ${params.objectId})`);
        return;
    }

    if (!canUserModifyObject(user.id, existingObj))
    {
        console.warn(`(RoomObjectUtil) Rejected objectDespawnParams from unauthorized user (userID = ${user.id})`);
        return;
    }

    // Remove the object
    delete room.objectById[params.objectId];

    // Unregister physics
    if (PhysicsManager.hasObject(room.id, params.objectId))
        PhysicsManager.removeObject(room.id, params.objectId);

    markDirtyIfPersistent(existingObj, roomID);

    // Broadcast to other clients
    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (socketRoomContext)
        socketRoomContext.multicastSignal("objectDespawnParams", params, user.id);
}

// Handle client-sent objectMetadataSetParams
export function handleObjectMetadataSet(socketUserContext: SocketUserContext, params: ObjectMetadataSetParams)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    if (!roomID)
    {
        console.error(`RoomManager.handleObjectMetadataSet :: RoomID not found (userID = ${user.id})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (!roomRuntimeMemory)
    {
        console.error(`RoomManager.handleObjectMetadataSet :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const room = roomRuntimeMemory.room;

    const existingObj = room.objectById[params.objectId];
    if (!existingObj)
    {
        console.error(`RoomManager.handleObjectMetadataSet :: Object not found (objectId = ${params.objectId})`);
        return;
    }

    if (!canUserModifyObject(user.id, existingObj))
    {
        console.warn(`(RoomObjectUtil) Rejected objectMetadataSetParams from unauthorized user (userID = ${user.id})`);
        return;
    }

    // Preprocess the metadata value (e.g. trim, truncate)
    params.metadataValue = ObjectMetadataEntryMap.preprocess(params.metadataKey, params.metadataValue);

    const obj = ObjectUpdateUtil.setObjectMetadata(room, params.objectId, params.metadataKey, params.metadataValue);
    if (!obj)
    {
        console.error(`RoomManager.handleObjectMetadataSet :: Failed (objectId = ${params.objectId})`);
        return;
    }

    markDirtyIfPersistent(obj, roomID);

    // Broadcast to other clients
    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (socketRoomContext)
        socketRoomContext.multicastSignal("objectMetadataSetParams", params, user.id);
}

// Handle client-sent objectMoveParams (e.g. moving a canvas)
export function handleObjectMove(socketUserContext: SocketUserContext, params: ObjectMoveParams)
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    if (!roomID)
    {
        console.error(`RoomManager.handleObjectMove :: RoomID not found (userID = ${user.id})`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (!roomRuntimeMemory)
    {
        console.error(`RoomManager.handleObjectMove :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const room = roomRuntimeMemory.room;

    const existingObj = room.objectById[params.objectId];
    if (!existingObj)
    {
        console.error(`RoomManager.handleObjectMove :: Object not found (objectId = ${params.objectId})`);
        return;
    }

    if (!canUserModifyObject(user.id, existingObj))
    {
        console.warn(`(RoomObjectUtil) Rejected objectMoveParams from unauthorized user (userID = ${user.id})`);
        return;
    }

    const moved = ObjectUpdateUtil.moveObject(room, params.objectId, params.dx, params.dy, params.dz);
    if (!moved)
    {
        console.error(`RoomManager.handleObjectMove :: Failed (objectId = ${params.objectId})`);
        return;
    }

    // Update physics
    if (PhysicsManager.hasObject(room.id, params.objectId))
    {
        PhysicsManager.removeObject(room.id, params.objectId);
        const colliderState = moved.getObjectColliderState();
        if (colliderState)
            PhysicsManager.addObject(room.id, params.objectId, moved.objectTypeIndex, colliderState);
    }

    markDirtyIfPersistent(moved, roomID);

    // Broadcast to other clients
    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (socketRoomContext)
        socketRoomContext.multicastSignal("objectMoveParams", params, user.id);
}
