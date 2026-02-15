import User from "../../../shared/user/types/user";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectRuntimeMemory from "../../../shared/object/types/objectRuntimeMemory";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import { unloadRoom } from "./roomCoreUtil";
import { addObject, removeObject } from "./roomObjectUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import UserGameplayState from "../../user/types/userGameplayState";
import DBUserUtil from "../../db/util/dbUserUtil";

export function addUserToRoom(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory,
    userID: string, playerObjectTransform: ObjectTransform)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    
    console.log(`RoomManager.addUserToRoom :: roomID = ${roomRuntimeMemory.room.id}, userID = ${userID}`);
    if (roomRuntimeMemory.participantUserIDs[userID] != undefined)
    {
        console.error(`RoomManager.addUserToRoom :: User is already registered (roomID = ${roomRuntimeMemory.room.id}, userID = ${userID})`);
        return;
    }
    RoomManager.currentRoomIDByUserID[userID] = roomRuntimeMemory.room.id;
    roomRuntimeMemory.participantUserIDs[userID] = true;

    const socketRoomContext = RoomManager.socketRoomContexts[roomRuntimeMemory.room.id];
    if (!socketRoomContext)
        console.error(`RoomManager.addUserToRoom :: SocketRoomContext not found (roomID = ${roomRuntimeMemory.room.id})`);
    else
        socketRoomContext.addSocketUserContext(userID, socketUserContext);

    // Create the user's player object
    addObject(socketUserContext, new ObjectRuntimeMemory(new ObjectSpawnParams(
        user.id,
        ObjectTypeConfigMap.getIndexByType("Player"),
        user.id, // Player object's objectId must be identical to the user's ID.
        playerObjectTransform
     )));
}

export async function removeUserFromRoom(socketUserContext: SocketUserContext, prevRoomShouldExist: boolean,
    saveGameplayState: boolean = true)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    console.log(`RoomManager.removeUserFromRoom :: roomID = ${roomID}, userID = ${user.id}`);
    if (roomID == undefined)
    {
        if (prevRoomShouldExist) // This may happen when the client disconnects before joining the very first room.
            console.warn(`RoomManager.removeUserFromRoom :: Previous room not found :: userID = ${user.id}`);
        return;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return;
    }
    if (saveGameplayState)
    {
        const gameplayState = getUserGameplayState(user.id, roomRuntimeMemory);
        if (gameplayState)
            await DBUserUtil.saveUserGameplayState(gameplayState);
    }

    const objectIds = getIdsOfObjectsSpawnedByUser(roomID, user.id);
    for (const objectId of objectIds)
        removeObject(socketUserContext, objectId);

    if (roomRuntimeMemory.participantUserIDs[user.id] == undefined)
    {
        console.error(`RoomManager.removeUserFromRoom :: User is not registered as the room's participant (userID = ${user.id}, roomID = ${roomID})`);
        return;
    }
    delete RoomManager.currentRoomIDByUserID[user.id];
    delete roomRuntimeMemory.participantUserIDs[user.id];

    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
    else
        socketRoomContext.removeSocketUserContext(user.id);

    if (Object.keys(roomRuntimeMemory.participantUserIDs).length == 0)
    {
        if (await DBRoomUtil.saveRoomContent(roomRuntimeMemory.room))
            unloadRoom(roomID);
    }
}

export function getIdsOfObjectsSpawnedByUser(roomID: string, userID: string): string[]
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
        if (objectRuntimeMemory.objectSpawnParams.sourceUserID == userID)
            ids.push(objectId);
    }
    return ids;
}

export function getUserGameplayState(userID: string, roomRuntimeMemory: RoomRuntimeMemory)
    : UserGameplayState | undefined
{
    // Player object's objectId must be identical to the user's ID.
    const playerObjectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[userID];
    if (!playerObjectRuntimeMemory)
    {
        console.error(`getUserGameplayState :: Player's ObjectRuntimeMemory not found (userID = ${userID})`);
        return undefined;
    }
    const tr = playerObjectRuntimeMemory.objectSpawnParams.transform;

    return {
        userID,
        lastRoomID: roomRuntimeMemory.room.id,
        lastX: tr.x,
        lastY: tr.y,
        lastZ: tr.z,
        lastDirX: tr.dirX,
        lastDirY: tr.dirY,
        lastDirZ: tr.dirZ,
    };
}