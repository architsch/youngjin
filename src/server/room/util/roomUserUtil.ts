import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
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
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { UserRole, UserRoleEnumMap } from "../../../shared/user/types/userRole";
import UserRoleUpdateParams from "../../../shared/user/types/userRoleUpdateParams";
import DBUserUtil from "../../db/util/dbUserUtil";

const playerObjectByUserID: {[userID: string]: ObjectSpawnParams} = {};
const userRoleByUserID: {[userID: string]: UserRole} = {};

export function addUserToRoom(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory,
    userID: string, playerObjectTransform: ObjectTransform, playerMetadata: {[key: string]: string},
    userRole: UserRole)
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
    for (const key of Object.keys(playerMetadata))
        restoredMetadata[parseInt(key)] = new EncodableByteString(playerMetadata[key]);
    const playerObjectSpawnParams = new ObjectSpawnParams(
        roomRuntimeMemory.room.id,
        user.id,
        user.userName,
        ObjectTypeConfigMap.getIndexByType("Player"),
        generateObjectId(),
        playerObjectTransform,
        restoredMetadata
    );
    addObject(socketUserContext, playerObjectSpawnParams);
    playerObjectByUserID[userID] = playerObjectSpawnParams;
    userRoleByUserID[userID] = userRole;
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
    delete playerObjectByUserID[user.id];
    delete userRoleByUserID[user.id];

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
    for (const [objectId, obj] of Object.entries(roomRuntimeMemory.room.objectById))
    {
        if (obj.sourceUserID == userID)
            ids.push(objectId);
    }
    return ids;
}

export function getUserGameplayState(socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory)
    : UserGameplayState | undefined
{
    const user = socketUserContext.user;
    const playerObject = playerObjectByUserID[user.id];
    if (!playerObject)
    {
        console.error(`getUserGameplayState :: Player's ObjectSpawnParams not found (userID = ${user.id})`);
        return undefined;
    }
    const tr = playerObject.transform;
    const rawMetadata = playerObject.metadata;
    const playerMetadata: {[key: string]: string} = {};
    for (const key of Object.keys(rawMetadata))
        playerMetadata[key] = rawMetadata[key as any].str;

    return {
        userID: user.id,
        userName: user.userName,
        email: user.email,
        lastRoomID: roomRuntimeMemory.room.id,
        userRole: userRoleByUserID[user.id] ?? UserRoleEnumMap.Visitor,
        lastX: tr.pos.x,
        lastY: tr.pos.y,
        lastZ: tr.pos.z,
        lastDirX: tr.dir.x,
        lastDirY: tr.dir.y,
        lastDirZ: tr.dir.z,
        playerMetadata,
        sessionDurationMs: Date.now() - socketUserContext.connectTime,
    };
}

export function getPlayerObject(userID: string): ObjectSpawnParams | undefined
{
    return playerObjectByUserID[userID];
}

// WARNING: Use this method only in integration tests.
export function clearPlayerObjects(): void
{
    for (const key in playerObjectByUserID)
        delete playerObjectByUserID[key];
    for (const key in userRoleByUserID)
        delete userRoleByUserID[key];
}

export function syncUserRoleInMemory(userID: string, roomID: string, userRole: UserRole): void
{
    // Update the authoritative role map.
    userRoleByUserID[userID] = userRole;

    // Broadcast the role update to all clients in the room.
    const socketRoomContext = RoomManager.socketRoomContexts[roomID];
    if (!socketRoomContext)
        return;

    const params = new UserRoleUpdateParams(userID, roomID, userRole);
    socketRoomContext.multicastSignal("userRoleUpdateParams", params);
}

export function getUserRole(userID: string): UserRole
{
    return userRoleByUserID[userID] ?? UserRoleEnumMap.Visitor;
}

export function canUserModifyRoom(userID: string): boolean
{
    const role = userRoleByUserID[userID] ?? UserRoleEnumMap.Visitor;
    if (role === UserRoleEnumMap.Owner || role === UserRoleEnumMap.Editor)
        return true;

    // Allow any user to modify rooms of type Hub.
    const roomID = RoomManager.currentRoomIDByUserID[userID];
    if (roomID)
    {
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory && roomRuntimeMemory.room.roomType === RoomTypeEnumMap.Hub)
            return true;
    }
    return false;
}
