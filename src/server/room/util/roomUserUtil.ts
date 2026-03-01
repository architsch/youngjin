import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectRuntimeMemory from "../../../shared/object/types/objectRuntimeMemory";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import { unloadRoom } from "./roomCoreUtil";
import { addObject, generateObjectId, removeObject } from "./roomObjectUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import UserGameplayState from "../../user/types/userGameplayState";
import DBUserUtil from "../../db/util/dbUserUtil";

const playerObjectRuntimeMemoryByUserID: {[userID: string]: ObjectRuntimeMemory} = {};

export function addUserToRoom(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory,
    userID: string, playerObjectTransform: ObjectTransform)
{
    const user = socketUserContext.user;

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
    const restoredMetadata: {[key: number]: EncodableByteString} = {};
    for (const key of Object.keys(user.playerMetadata))
        restoredMetadata[parseInt(key)] = new EncodableByteString(user.playerMetadata[key]);
    const playerObjectRuntimeMemory = new ObjectRuntimeMemory(new ObjectSpawnParams(
        roomRuntimeMemory.room.id,
        user.id,
        user.userName,
        ObjectTypeConfigMap.getIndexByType("Player"),
        generateObjectId(),
        playerObjectTransform,
        restoredMetadata
    ));
    addObject(socketUserContext, playerObjectRuntimeMemory);
    playerObjectRuntimeMemoryByUserID[userID] = playerObjectRuntimeMemory;
}

export async function removeUserFromRoom(socketUserContext: SocketUserContext, prevRoomShouldExist: boolean,
    saveGameplayState: boolean)
{
    const user = socketUserContext.user;
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
        const gameplayState = getUserGameplayState(socketUserContext, roomRuntimeMemory);
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
    delete playerObjectRuntimeMemoryByUserID[user.id];

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

export function getUserGameplayState(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory)
    : UserGameplayState | undefined
{
    const user = socketUserContext.user;
    const playerObjectRuntimeMemory = playerObjectRuntimeMemoryByUserID[user.id];
    if (!playerObjectRuntimeMemory)
    {
        console.error(`getUserGameplayState :: Player's ObjectRuntimeMemory not found (userID = ${user.id})`);
        return undefined;
    }
    const tr = playerObjectRuntimeMemory.objectSpawnParams.transform;
    const rawMetadata = playerObjectRuntimeMemory.objectSpawnParams.metadata;
    const playerMetadata: {[key: string]: string} = {};
    for (const key of Object.keys(rawMetadata))
        playerMetadata[key] = rawMetadata[key as any].str;

    return {
        userID: user.id,
        lastRoomID: roomRuntimeMemory.room.id,
        lastX: tr.x,
        lastY: tr.y,
        lastZ: tr.z,
        lastDirX: tr.dirX,
        lastDirY: tr.dirY,
        lastDirZ: tr.dirZ,
        playerMetadata,
        sessionDurationMs: Date.now() - socketUserContext.connectTime,
    };
}

export function getPlayerObjectRuntimeMemory(userID: string): ObjectRuntimeMemory | undefined
{
    return playerObjectRuntimeMemoryByUserID[userID];
}

// WARNING: Use this method only in integration tests.
export function clearPlayerObjectRuntimeMemories(): void
{
    for (const key in playerObjectRuntimeMemoryByUserID)
        delete playerObjectRuntimeMemoryByUserID[key];
}