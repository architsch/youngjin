import User from "../../../shared/user/types/user";
import AABB2 from "../../../shared/math/types/aabb2";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectDespawnParams from "../../../shared/object/types/objectDespawnParams";
import ObjectRuntimeMemory from "../../../shared/object/types/objectRuntimeMemory";
import PhysicsManager from "../../../shared/physics/physicsManager";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";

export function addObject(socketUserContext: SocketUserContext, objectRuntimeMemory: ObjectRuntimeMemory)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    const objectId = objectRuntimeMemory.objectSpawnParams.objectId;

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
    if (roomRuntimeMemory.objectRuntimeMemories[objectId] != undefined)
    {
        console.error(`RoomManager.addObject :: ObjectRuntimeMemory already exists (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    roomRuntimeMemory.objectRuntimeMemories[objectId] = objectRuntimeMemory;

    const config = ObjectTypeConfigMap.getConfigByIndex(objectRuntimeMemory.objectSpawnParams.objectTypeIndex);
    
    const colliderConfig = config.components.spawnedByAny?.dynamicCollider ?? config.components.spawnedByAny?.staticCollider;
    if (colliderConfig)
    {
        const halfSizeX = 0.5 * colliderConfig.hitboxSize.sizeX;
        const halfSizeY = 0.5 * colliderConfig.hitboxSize.sizeZ;
    
        const hitbox: AABB2 = {
            x: objectRuntimeMemory.objectSpawnParams.transform.x,
            y: objectRuntimeMemory.objectSpawnParams.transform.z,
            halfSizeX,
            halfSizeY,
        };
        PhysicsManager.addObject(roomID, objectId,
            objectRuntimeMemory.objectSpawnParams.transform.y, hitbox,
            colliderConfig.collisionLayerMaskAtGroundLevel);
    }

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectSpawnParams", objectRuntimeMemory.objectSpawnParams, user.id);
}

export function removeObject(socketUserContext: SocketUserContext, objectId: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
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
    const objectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[objectId];
    if (objectRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeObject :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
        return;
    }
    delete roomRuntimeMemory.objectRuntimeMemories[objectId];

    const config = ObjectTypeConfigMap.getConfigByIndex(objectRuntimeMemory.objectSpawnParams.objectTypeIndex);
    const colliderConfig = config.components.spawnedByAny?.dynamicCollider ?? config.components.spawnedByAny?.staticCollider;
    if (colliderConfig)
        PhysicsManager.removeObject(roomID, objectId);
    
    const despawnParams = new ObjectDespawnParams(objectId);

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectDespawnParams", despawnParams, user.id);
}