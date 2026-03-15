import ObjectDespawnParams from "../../../shared/object/types/objectDespawnParams";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import PhysicsManager from "../../../shared/physics/physicsManager";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";

let serverObjectIdCounter = 0;

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
