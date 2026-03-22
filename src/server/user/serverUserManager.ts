import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import EncodableByteString from "../../shared/networking/types/encodableByteString";
import ObjectTransform from "../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerObjectManager from "../object/serverObjectManager";
import DBRoomUtil from "../db/util/dbRoomUtil";
import UserGameplayState from "./types/userGameplayState";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import SetUserRoleSignal from "../../shared/user/types/setUserRoleSignal";
import DBUserUtil from "../db/util/dbUserUtil";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";

const socketUserContexts: {[userID: string]: SocketUserContext} = {};
const playerObjectByUserID: {[userID: string]: AddObjectSignal} = {};
const userRoleByUserID: {[userID: string]: UserRole} = {};

const ServerUserManager =
{
    socketUserContexts,
    addUser: (socketUserContext: SocketUserContext) =>
    {
        socketUserContexts[socketUserContext.user.id] = socketUserContext;
    },
    removeUser: (userID: string) =>
    {
        delete socketUserContexts[userID];
    },
    getSocketUserContext: (userID: string): SocketUserContext | undefined =>
    {
        return socketUserContexts[userID];
    },
    hasUser: (userID: string): boolean =>
    {
        return socketUserContexts[userID] != undefined;
    },
    addUserToRoom: (socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory,
        userID: string, playerObjectTransform: ObjectTransform, playerMetadata: {[key: string]: string},
        userRole: UserRole) =>
    {
        const user = socketUserContext.user;

        console.log(`ServerUserManager.addUserToRoom :: roomID = ${roomRuntimeMemory.room.id}, userID = ${userID}`);
        if (roomRuntimeMemory.participantUserIDs[userID] != undefined)
        {
            console.error(`ServerUserManager.addUserToRoom :: User is already registered (roomID = ${roomRuntimeMemory.room.id}, userID = ${userID})`);
            return;
        }
        ServerRoomManager.currentRoomIDByUserID[userID] = roomRuntimeMemory.room.id;
        roomRuntimeMemory.participantUserIDs[userID] = true;

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomRuntimeMemory.room.id];
        if (!socketRoomContext)
            console.error(`ServerUserManager.addUserToRoom :: SocketRoomContext not found (roomID = ${roomRuntimeMemory.room.id})`);
        else
            socketRoomContext.addSocketUserContext(userID, socketUserContext);

        // Create the user's player object
        const restoredMetadata: {[key: number]: EncodableByteString} = {};
        for (const key of Object.keys(playerMetadata))
            restoredMetadata[parseInt(key)] = new EncodableByteString(playerMetadata[key]);
        const playerAddObjectSignal = new AddObjectSignal(
            roomRuntimeMemory.room.id,
            user.id,
            user.userName,
            ObjectTypeConfigMap.getIndexByType("Player"),
            ServerObjectManager.generateObjectId(),
            playerObjectTransform,
            restoredMetadata
        );
        ServerObjectManager.addObject(socketUserContext, playerAddObjectSignal);
        playerObjectByUserID[userID] = playerAddObjectSignal;
        userRoleByUserID[userID] = userRole;
    },
    removeUserFromRoom: async (socketUserContext: SocketUserContext, prevRoomShouldExist: boolean,
        saveGameplayState: boolean) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        console.log(`ServerUserManager.removeUserFromRoom :: roomID = ${roomID}, userID = ${user.id}`);
        if (roomID == undefined)
        {
            if (prevRoomShouldExist) // This may happen when the client disconnects before joining the very first room.
                console.warn(`ServerUserManager.removeUserFromRoom :: Previous room not found :: userID = ${user.id}`);
            return;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`ServerUserManager.removeUserFromRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        if (saveGameplayState)
        {
            const gameplayState = ServerUserManager.getUserGameplayState(socketUserContext, roomRuntimeMemory);
            if (gameplayState)
                await DBUserUtil.saveUserGameplayState(gameplayState);
        }

        const objectIds = getIdsOfObjectsSpawnedByUser(roomID, user.id);
        for (const objectId of objectIds)
            ServerObjectManager.removeObject(socketUserContext, objectId);

        if (roomRuntimeMemory.participantUserIDs[user.id] == undefined)
        {
            console.error(`ServerUserManager.removeUserFromRoom :: User is not registered as the room's participant (userID = ${user.id}, roomID = ${roomID})`);
            return;
        }
        delete ServerRoomManager.currentRoomIDByUserID[user.id];
        delete roomRuntimeMemory.participantUserIDs[user.id];
        delete playerObjectByUserID[user.id];
        delete userRoleByUserID[user.id];

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerUserManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.removeSocketUserContext(user.id);

        if (Object.keys(roomRuntimeMemory.participantUserIDs).length == 0)
        {
            if (await DBRoomUtil.saveRoomContent(roomRuntimeMemory.room))
                ServerRoomManager.unloadRoom(roomID);
        }
    },
    getUserGameplayState: (socketUserContext: SocketUserContext, roomRuntimeMemory: RoomRuntimeMemory)
        : UserGameplayState | undefined =>
    {
        const user = socketUserContext.user;
        const playerObject = playerObjectByUserID[user.id];
        if (!playerObject)
        {
            console.error(`getUserGameplayState :: Player's AddObjectSignal not found (userID = ${user.id})`);
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
    },
    getPlayerObject: (userID: string): AddObjectSignal | undefined =>
    {
        return playerObjectByUserID[userID];
    },
    // WARNING: Use this method only in integration tests.
    clearPlayerObjects: (): void =>
    {
        for (const key in playerObjectByUserID)
            delete playerObjectByUserID[key];
        for (const key in userRoleByUserID)
            delete userRoleByUserID[key];
    },
    syncUserRoleInMemory: (userID: string, roomID: string, userRole: UserRole): void =>
    {
        // Update the authoritative role map.
        userRoleByUserID[userID] = userRole;

        // Broadcast the role update to all clients in the room.
        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            return;

        const params = new SetUserRoleSignal(userID, roomID, userRole);
        socketRoomContext.multicastSignal("setUserRoleSignal", params);
    },
    getUserRole: (userID: string): UserRole =>
    {
        return userRoleByUserID[userID] ?? UserRoleEnumMap.Visitor;
    },
    canUserEditRoom: (userID: string): boolean =>
    {
        const role = ServerUserManager.getUserRole(userID);
        // User has permission to edit the room
        if (role === UserRoleEnumMap.Owner || role === UserRoleEnumMap.Editor)
            return true;
        const roomID = ServerRoomManager.currentRoomIDByUserID[userID];
        if (roomID)
        {
            const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
            // Room is a hub (i.e. free to be edited by anyone)
            if (roomRuntimeMemory && roomRuntimeMemory.room.roomType === RoomTypeEnumMap.Hub)
                return true;
        }
        return false;
    },
}

function getIdsOfObjectsSpawnedByUser(roomID: string, userID: string): string[]
{
    const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`ServerUserManager.getIdsOfObjectsSpawnedByUser :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
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

export default ServerUserManager;
