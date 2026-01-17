import User from "../../../shared/user/types/user";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectRuntimeMemory from "../../../shared/object/types/objectRuntimeMemory";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
//import { unloadRoom } from "./roomCoreUtil";
import { addObject, removeObject } from "./roomObjectUtil";

let lastObjectIdNumber = 0;

export function addUserToRoom(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory, userName: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    
    console.log(`RoomManager.addUserToRoom :: roomID = ${roomRuntimeMemory.room.roomID}, userName = ${userName}`);
    if (roomRuntimeMemory.participantUserNames[userName] != undefined)
    {
        console.error(`RoomManager.addUserToRoom :: User is already registered (roomID = ${roomRuntimeMemory.room.roomID}, userName = ${userName})`);
        return;
    }
    RoomManager.currentRoomIDByUserName[userName] = roomRuntimeMemory.room.roomID;
    roomRuntimeMemory.participantUserNames[userName] = true;

    const socketRoomContext = RoomManager.socketRoomContexts[roomRuntimeMemory.room.roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addUserToRoom :: SocketRoomContext not found (roomID = ${roomRuntimeMemory.room.roomID})`);
    else
        socketRoomContext.addSocketUserContext(userName, socketUserContext);

    // Create the user's player object
    addObject(socketUserContext, new ObjectRuntimeMemory(new ObjectSpawnParams(
        user.userName,
        ObjectTypeConfigMap.getIndexByType("Player"),
        `#${++lastObjectIdNumber}`,
        new ObjectTransform(
            16, 0, 16,
            0, 0, 1
        ),
        ""
     )));
}

export function removeUserFromRoom(socketUserContext: SocketUserContext, prevRoomShouldExist: boolean)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserName[user.userName];
    console.log(`RoomManager.removeUserFromRoom :: roomID = ${roomID}, userName = ${user.userName}`);
    if (roomID == undefined)
    {
        if (prevRoomShouldExist) // This may happen when the client disconnects before joining the very first room.
            console.warn(`RoomManager.removeUserFromRoom :: Previous room not found :: userName = ${user.userName}`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    const objectIds = getIdsOfObjectsSpawnedByUser(roomID, user.userName);
    for (const objectId of objectIds)
        removeObject(socketUserContext, objectId);

    if (roomRuntimeMemory.participantUserNames[user.userName] == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: User is not registered as the room's participant (userName = ${user.userName}, roomID = ${roomID})`);
        return;
    }
    delete RoomManager.currentRoomIDByUserName[user.userName];
    delete roomRuntimeMemory.participantUserNames[user.userName];

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.removeSocketUserContext(user.userName);

    // NOTE: For now, don't unload a room even if there's no user left in it.
    //if (Object.keys(roomRuntimeMemory.participantUserNames).length == 0)
    //    unloadRoom(roomID);
}

export function getIdsOfObjectsSpawnedByUser(roomID: number, userName: string): string[]
{
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.getIdsOfObjectsSpawnedByUser :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return [];
    }
    const ids: string[] = [];
    for (const [objectId, objectRuntimeMemory] of Object.entries(roomRuntimeMemory.objectRuntimeMemories))
    {
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName == userName)
            ids.push(objectId);
    }
    return ids;
}