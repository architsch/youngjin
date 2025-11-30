import User from "../../../shared/auth/user";
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
    const roomID = RoomManager.currentRoomIDByUserName[user.userName];
    const objectId = objectRuntimeMemory.objectSpawnParams.objectId;

    console.log(`RoomManager.addObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.addObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
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
    
    const colliderConfig = config.components.spawnedByAny?.collider;
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
        PhysicsManager.addObject(roomID, objectId, hitbox, colliderConfig.collisionLayer);
    }

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectSpawnParams", objectRuntimeMemory.objectSpawnParams, user.userName);
}

export function removeObject(socketUserContext: SocketUserContext, objectId: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserName[user.userName];
    console.log(`RoomManager.removeObject :: roomID = ${roomID}, userName = ${user.userName}, objectId = ${objectId}`);
    if (roomID == undefined)
    {
        console.error(`RoomManager.removeObject :: RoomID not found (userName = ${user.userName}, objectId = ${objectId})`);
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
    const colliderConfig = config.components.spawnedByAny?.collider;
    if (colliderConfig)
        PhysicsManager.removeObject(roomID, objectId);
    
    const despawnParams = new ObjectDespawnParams(objectId);

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeObject :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.multicastSignal("objectDespawnParams", despawnParams, user.userName);
}