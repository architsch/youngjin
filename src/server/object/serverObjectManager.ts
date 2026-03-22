import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import PhysicsManager from "../../shared/physics/physicsManager";
import { MAX_CANVASES_PER_ROOM } from "../../shared/system/sharedConstants";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerUserManager from "../user/serverUserManager";
import ObjectTransform from "../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";
import PhysicsCollisionUtil from "../../shared/physics/util/physicsCollisionUtil";

let serverObjectIdCounter = 0;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

const ServerObjectManager =
{
    generateObjectId: (): string =>
    {
        return `s${++serverObjectIdCounter}`;
    },
    addObject: (socketUserContext: SocketUserContext, addObjectSignal: AddObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const objectId = addObjectSignal.objectId;

        console.log(`ServerObjectManager.addObject :: roomID = ${roomID}, userID = ${user.id}, objectId = ${objectId}`);
        if (roomID == undefined)
        {
            console.error(`ServerObjectManager.addObject :: RoomID not found (userID = ${user.id}, objectId = ${objectId})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`ServerObjectManager.addObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (roomRuntimeMemory.room.objectById[objectId] != undefined)
        {
            console.error(`ServerObjectManager.addObject :: Object already exists (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        roomRuntimeMemory.room.objectById[objectId] = addObjectSignal;

        const colliderState = addObjectSignal.getObjectColliderState();
        if (colliderState)
            PhysicsManager.addObject(roomID, objectId, addObjectSignal.objectTypeIndex, colliderState);

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerObjectManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("addObjectSignal", addObjectSignal, user.id);
    },
    removeObject: (socketUserContext: SocketUserContext, objectId: string) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        console.log(`ServerObjectManager.removeObject :: roomID = ${roomID}, userID = ${user.id}, objectId = ${objectId}`);
        if (roomID == undefined)
        {
            console.error(`ServerObjectManager.removeObject :: RoomID not found (userID = ${user.id}, objectId = ${objectId})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`ServerObjectManager.removeObject :: RoomRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        const addObjectSignal = roomRuntimeMemory.room.objectById[objectId];
        if (addObjectSignal == undefined)
        {
            console.error(`ServerObjectManager.removeObject :: Object doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        delete roomRuntimeMemory.room.objectById[objectId];

        const colliderState = addObjectSignal.getObjectColliderState();
        if (colliderState)
            PhysicsManager.removeObject(roomID, objectId);

        const removeSignal = new RemoveObjectSignal(roomID, objectId);

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerObjectManager.removeObject :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("removeObjectSignal", removeSignal, user.id);
    },
    // Handle client-sent addObjectSignal (e.g. adding a canvas)
    onAddObjectSignalReceived: (socketUserContext: SocketUserContext, obj: AddObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`ServerObjectManager.onAddObjectSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`ServerObjectManager.onAddObjectSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;
        if (!ServerUserManager.canUserEditRoom(user.id))
        {
            console.warn(`ServerObjectManager.onAddObjectSignalReceived :: Rejected addObjectSignal from unauthorized user (userID = ${user.id})`);
            return;
        }

        // Validate canvas limit
        if (obj.objectTypeIndex === canvasTypeIndex)
        {
            const canvasCount = Object.values(room.objectById)
                .filter(obj => obj.objectTypeIndex === canvasTypeIndex).length;
            if (canvasCount >= MAX_CANVASES_PER_ROOM)
            {
                console.error(`onAddObjectSignalReceived :: Canvas limit reached (${MAX_CANVASES_PER_ROOM}) in room ${room.id}`);
                socketUserContext.addPendingSignalToUser("removeObjectSignal",
                    new RemoveObjectSignal(room.id, obj.objectId));
                return;
            }
        }

        // Verify client's objectId matches expected server-side objectId
        const expectedObjectId = `p${room.lastObjectId + 1}`;
        if (obj.objectId !== expectedObjectId)
        {
            console.error(`onAddObjectSignalReceived :: ObjectId mismatch (expected=${expectedObjectId}, received=${obj.objectId})`);
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, obj.objectId));
            return;
        }

        // Validate placement
        const t = obj.transform;
        if (!ObjectUpdateUtil.canAddObject(room, obj.objectTypeIndex, t.pos, t.dir))
        {
            console.error(`onAddObjectSignalReceived :: Placement validation failed (objectId=${obj.objectId})`);
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, obj.objectId));
            return;
        }

        // Add the object
        room.objectById[obj.objectId] = obj;
        ++room.lastObjectId;

        // Register physics
        const colliderState = obj.getObjectColliderState();
        if (colliderState)
            PhysicsManager.addObject(room.id, obj.objectId, obj.objectTypeIndex, colliderState);

        markRoomAsDirtyIfPersistent(obj, roomID);

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("addObjectSignal", obj, user.id);
    },
    // Handle client-sent removeObjectSignal (e.g. removing a canvas)
    onRemoveObjectSignalReceived: (socketUserContext: SocketUserContext, params: RemoveObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`ServerObjectManager.onRemoveObjectSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`ServerObjectManager.onRemoveObjectSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;
        const existingObj = room.objectById[params.objectId];
        if (!existingObj)
        {
            console.error(`ServerObjectManager.onRemoveObjectSignalReceived :: Object not found (objectId = ${params.objectId})`);
            return;
        }
        if (!canUserEditObject(user.id, existingObj))
        {
            console.warn(`(ServerObjectManager) Rejected removeObjectSignal from unauthorized user (userID = ${user.id})`);
            return;
        }

        // Remove the object
        delete room.objectById[params.objectId];

        // Unregister physics
        if (PhysicsManager.hasObject(room.id, params.objectId))
            PhysicsManager.removeObject(room.id, params.objectId);

        markRoomAsDirtyIfPersistent(existingObj, roomID);

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("removeObjectSignal", params, user.id);
    },
    // Handle client-sent setObjectMetadataSignal
    onSetObjectMetadataSignalReceived: (socketUserContext: SocketUserContext, params: SetObjectMetadataSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`ServerObjectManager.onSetObjectMetadataSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`ServerObjectManager.onSetObjectMetadataSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        const existingObj = room.objectById[params.objectId];
        if (!existingObj)
        {
            console.error(`ServerObjectManager.onSetObjectMetadataSignalReceived :: Object not found (objectId = ${params.objectId})`);
            return;
        }
        if (!canUserEditObject(user.id, existingObj))
        {
            console.warn(`ServerObjectManager.onSetObjectMetadataSignalReceived :: Unauthorized user (userID = ${user.id})`);
            return;
        }

        // Preprocess the metadata value (e.g. trim, truncate)
        params.metadataValue = ObjectMetadataEntryMap.preprocess(params.metadataKey, params.metadataValue);

        const obj = ObjectUpdateUtil.setObjectMetadata(room, params.objectId, params.metadataKey, params.metadataValue);
        if (!obj)
        {
            console.error(`ServerObjectManager.onSetObjectMetadataSignalReceived :: Failed (objectId = ${params.objectId})`);
            return;
        }

        markRoomAsDirtyIfPersistent(obj, roomID);

        // Broadcast to other clients
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("setObjectMetadataSignal", params, user.id);
    },
    // Handle client-sent setObjectTransformSignal (object transform sync)
    onSetObjectTransformSignalReceived: (socketUserContext: SocketUserContext, objectId: string, transform: ObjectTransform) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        if (roomID == undefined)
        {
            console.error(`ServerObjectManager.onSetObjectTransformSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`ServerObjectManager.onSetObjectTransformSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const obj = roomRuntimeMemory.room.objectById[objectId];
        if (obj == undefined)
        {
            console.error(`ServerObjectManager.onSetObjectTransformSignalReceived :: Object doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (!canUserEditObject(user.id, obj))
        {
            console.warn(`ServerObjectManager.onSetObjectTransformSignalReceived :: Unauthorized user (userID = ${user.id})`);
            return;
        }

        const colliderState = PhysicsCollisionUtil.getObjectColliderState(
            obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
        const ignorePhysics = colliderState?.colliderConfig.colliderType != "rigidbody";

        const result = ObjectUpdateUtil.setObjectTransform(roomRuntimeMemory.room,
            objectId, { ...transform.pos }, { ...transform.dir }, ignorePhysics);

        markRoomAsDirtyIfPersistent(obj, roomID);

        // If desync was detected,
        //      Broadcast to everyone (including the sender).
        // Otherwise,
        //      Broadcast to everyone except the one who sent the signal. 
        const signal = new SetObjectTransformSignal(objectId, transform, true);
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerObjectManager.onSetObjectTransformSignalReceived :: SocketRoomContext not found (roomID = ${roomID})`);
        else 
            socketRoomContext.multicastSignal("setObjectTransformSignal", signal, result.desyncDetected ? undefined : user.id);
    },
}

function canUserEditObject(userID: string, obj: AddObjectSignal): boolean
{
    // User can modify an existing object if either:
    // (1) The object has no owner and the user is allowed to edit the room, or
    // (2) The object is owned by the user.
    return (obj.sourceUserID == "" && ServerUserManager.canUserEditRoom(userID)) ||
        obj.sourceUserID == userID;
}

function markRoomAsDirtyIfPersistent(obj: AddObjectSignal, roomID: string): void
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    if (config.persistent)
    {
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory)
            roomRuntimeMemory.room.dirty = true;
    }
}

export default ServerObjectManager;
