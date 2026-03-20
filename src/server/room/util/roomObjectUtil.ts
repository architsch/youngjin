import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { MAX_CANVASES_PER_ROOM } from "../../../shared/system/sharedConstants";
import { UserRoleEnumMap } from "../../../shared/user/types/userRole";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import RoomUserUtil from "./roomUserUtil";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import ResolveObjectTransformDesyncSignal from "../../../shared/object/types/resolveObjectTransformDesyncSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import Vec3 from "../../../shared/math/types/vec3";

let serverObjectIdCounter = 0;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

function canUserModifyObject(userID: string, obj: AddObjectSignal): boolean
{
    if (obj.sourceUserID === userID)
        return true;
    const role = RoomUserUtil.getUserRole(userID);
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

function markDirtyIfPersistent(obj: AddObjectSignal, roomID: string): void
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    if (config.persistent)
    {
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory)
            roomRuntimeMemory.room.dirty = true;
    }
}

const RoomObjectUtil =
{
    generateObjectId: (): string =>
    {
        return `s${++serverObjectIdCounter}`;
    },
    addObject: (socketUserContext: SocketUserContext, addObjectSignal: AddObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = RoomManager.currentRoomIDByUserID[user.id];
        const objectId = addObjectSignal.objectId;

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
        roomRuntimeMemory.room.objectById[objectId] = addObjectSignal;

        const colliderState = addObjectSignal.getObjectColliderState();
        if (colliderState)
            PhysicsManager.addObject(roomID, objectId, addObjectSignal.objectTypeIndex, colliderState);

        const socketRoomContext = RoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("addObjectSignal", addObjectSignal, user.id);
    },
    removeObject: (socketUserContext: SocketUserContext, objectId: string) =>
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
        const addObjectSignal = roomRuntimeMemory.room.objectById[objectId];
        if (addObjectSignal == undefined)
        {
            console.error(`RoomManager.removeObject :: Object doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        delete roomRuntimeMemory.room.objectById[objectId];

        const colliderState = addObjectSignal.getObjectColliderState();
        if (colliderState)
            PhysicsManager.removeObject(roomID, objectId);

        const removeSignal = new RemoveObjectSignal(roomID, objectId);

        const socketRoomContext = RoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.removeObject :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("removeObjectSignal", removeSignal, user.id);
    },
    // Handle client-sent addObjectSignal (e.g. adding a canvas)
    onAddObjectSignalReceived: (socketUserContext: SocketUserContext, params: AddObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = RoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`RoomManager.onAddObjectSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`RoomManager.onAddObjectSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        if (!canUserModifyObject(user.id, params))
        {
            console.warn(`(RoomObjectUtil) Rejected addObjectSignal from unauthorized user (userID = ${user.id})`);
            return;
        }

        // Validate canvas limit
        if (params.objectTypeIndex === canvasTypeIndex)
        {
            const canvasCount = Object.values(room.objectById)
                .filter(obj => obj.objectTypeIndex === canvasTypeIndex).length;
            if (canvasCount >= MAX_CANVASES_PER_ROOM)
            {
                console.error(`onAddObjectSignalReceived :: Canvas limit reached (${MAX_CANVASES_PER_ROOM}) in room ${room.id}`);
                socketUserContext.addPendingSignalToUser("removeObjectSignal",
                    new RemoveObjectSignal(room.id, params.objectId));
                return;
            }
        }

        // Verify client's objectId matches expected server-side objectId
        const expectedObjectId = `p${room.lastObjectId + 1}`;
        if (params.objectId !== expectedObjectId)
        {
            console.error(`onAddObjectSignalReceived :: ObjectId mismatch (expected=${expectedObjectId}, received=${params.objectId})`);
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, params.objectId));
            return;
        }

        // Validate placement
        const t = params.transform;
        if (!ObjectUpdateUtil.canAddObject(room, params.objectTypeIndex, t.pos, t.dir))
        {
            console.error(`onAddObjectSignalReceived :: Placement validation failed (objectId=${params.objectId})`);
            socketUserContext.addPendingSignalToUser("removeObjectSignal",
                new RemoveObjectSignal(room.id, params.objectId));
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
            socketRoomContext.multicastSignal("addObjectSignal", params, user.id);
    },
    // Handle client-sent removeObjectSignal (e.g. removing a canvas)
    onRemoveObjectSignalReceived: (socketUserContext: SocketUserContext, params: RemoveObjectSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = RoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`RoomManager.onRemoveObjectSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`RoomManager.onRemoveObjectSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;
        const existingObj = room.objectById[params.objectId];
        if (!existingObj)
        {
            console.error(`RoomManager.onRemoveObjectSignalReceived :: Object not found (objectId = ${params.objectId})`);
            return;
        }

        if (!canUserModifyObject(user.id, existingObj))
        {
            console.warn(`(RoomObjectUtil) Rejected removeObjectSignal from unauthorized user (userID = ${user.id})`);
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
            socketRoomContext.multicastSignal("removeObjectSignal", params, user.id);
    },
    // Handle client-sent setObjectMetadataSignal
    onSetObjectMetadataSignalReceived: (socketUserContext: SocketUserContext, params: SetObjectMetadataSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = RoomManager.currentRoomIDByUserID[user.id];
        if (!roomID)
        {
            console.error(`RoomManager.onSetObjectMetadataSignalReceived :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            console.error(`RoomManager.onSetObjectMetadataSignalReceived :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        const existingObj = room.objectById[params.objectId];
        if (!existingObj)
        {
            console.error(`RoomManager.onSetObjectMetadataSignalReceived :: Object not found (objectId = ${params.objectId})`);
            return;
        }

        if (!canUserModifyObject(user.id, existingObj))
        {
            console.warn(`(RoomObjectUtil) Rejected setObjectMetadataSignal from unauthorized user (userID = ${user.id})`);
            return;
        }

        // Preprocess the metadata value (e.g. trim, truncate)
        params.metadataValue = ObjectMetadataEntryMap.preprocess(params.metadataKey, params.metadataValue);

        const obj = ObjectUpdateUtil.setObjectMetadata(room, params.objectId, params.metadataKey, params.metadataValue);
        if (!obj)
        {
            console.error(`RoomManager.onSetObjectMetadataSignalReceived :: Failed (objectId = ${params.objectId})`);
            return;
        }

        markDirtyIfPersistent(obj, roomID);

        // Broadcast to other clients
        const socketRoomContext = RoomManager.socketRoomContexts[roomID];
        if (socketRoomContext)
            socketRoomContext.multicastSignal("setObjectMetadataSignal", params, user.id);
    },
    // Handle client-sent setObjectTransformSignal (object transform sync)
    updateObjectTransform: (socketUserContext: SocketUserContext, objectId: string, transform: ObjectTransform) =>
    {
        const user = socketUserContext.user;
        const roomID = RoomManager.currentRoomIDByUserID[user.id];
        if (roomID == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const obj = roomRuntimeMemory.room.objectById[objectId];
        if (obj == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: Object doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (obj.sourceUserID != user.id)
        {
            console.error(`RoomManager.updateObjectTransform :: User has no authority to control this object (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }

        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        const hasDynamicCollider = config.components.spawnedByAny?.dynamicCollider != null;

        const targetPos: Vec3 = { ...transform.pos };
        const targetDir: Vec3 = { ...transform.dir };

        if (hasDynamicCollider)
        {
            const result = PhysicsManager.trySetTransform(roomID, objectId, obj.objectTypeIndex, targetPos, targetDir);
            transform.pos.x = result.resolvedPos.x;
            transform.pos.y = result.resolvedPos.y;
            transform.pos.z = result.resolvedPos.z;
            Object.assign(obj.transform, transform);

            if (result.desyncDetected)
            {
                const desyncSignal = new ResolveObjectTransformDesyncSignal(objectId, result.resolvedPos);
                const socketRoomContext = RoomManager.socketRoomContexts[roomID];
                if (!socketRoomContext)
                    console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
                else // Broadcast to everyone.
                    socketRoomContext.multicastSignal("resolveObjectTransformDesyncSignal", desyncSignal);
            }
            else
            {
                const syncSignal = new SetObjectTransformSignal(objectId, transform);
                const socketRoomContext = RoomManager.socketRoomContexts[roomID];
                if (!socketRoomContext)
                    console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
                else // Broadcast to everyone except the one who sent the setObjectTransformSignal.
                    socketRoomContext.multicastSignal("setObjectTransformSignal", syncSignal, user.id);
            }
        }
        else
        {
            // No dynamic collider - force set the transform without physics validation.
            PhysicsManager.forceSetTransform(roomID, objectId, obj.objectTypeIndex, targetPos, targetDir);
            Object.assign(obj.transform, transform);

            markDirtyIfPersistent(obj, roomID);

            const syncSignal = new SetObjectTransformSignal(objectId, transform);
            const socketRoomContext = RoomManager.socketRoomContexts[roomID];
            if (!socketRoomContext)
                console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
            else // Broadcast to everyone except the one who sent the setObjectTransformSignal.
                socketRoomContext.multicastSignal("setObjectTransformSignal", syncSignal, user.id);
        }
    },
}

export default RoomObjectUtil;
