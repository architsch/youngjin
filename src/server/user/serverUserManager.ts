import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import EncodableByteString from "../../shared/networking/types/encodableByteString";
import ObjectTransform from "../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import UserContext from "../sockets/types/userContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerObjectManager from "../object/serverObjectManager";
import DBRoomUtil from "../db/util/dbRoomUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import ObjectMetadataEntryMap from "../../shared/object/maps/objectMetadataEntryMap";
import { ObjectMetadataKeyEnumMap } from "../../shared/object/types/objectMetadataKey";
import { UserTypeEnumMap } from "../../shared/user/types/userType";
import { HELPER_AGENT_NAME } from "../system/serverConstants";

const socketUserContexts: {[userID: string]: UserContext} = {};
const playerObjectByUserID: {[userID: string]: AddObjectSignal} = {};

// Player metadata captured at disconnect, read on reconnect before DBUser (the DB write may not have
// landed). Evicted on reconnect or by TTL (SocketsServer's stale-socket sweep).
const recentDisconnectMetadata: {[userID: string]: {metadata: {[key: string]: string}; timestamp: number}} = {};

const ServerUserManager =
{
    socketUserContexts,
    recentDisconnectMetadata,
    addUser: (socketUserContext: UserContext) =>
    {
        socketUserContexts[socketUserContext.user.id] = socketUserContext;
    },
    removeUser: (userID: string) =>
    {
        delete socketUserContexts[userID];
    },
    getSocketUserContext: (userID: string): UserContext | undefined =>
    {
        return socketUserContexts[userID];
    },
    hasUser: (userID: string): boolean =>
    {
        return socketUserContexts[userID] != undefined;
    },
    // Registers the user in the room and spawns their player. Returns the room joined, or undefined.
    addUserToRoom: async (socketUserContext: UserContext, roomRuntimeMemory: RoomRuntimeMemory,
        userID: string, playerObjectTransform: ObjectTransform,
        playerMetadata: {[key: string]: string}): Promise<RoomRuntimeMemory | undefined> =>
    {
        const user = socketUserContext.user;
        const roomID = roomRuntimeMemory.room.id;

        console.log(`ServerUserManager.addUserToRoom :: roomID = ${roomID}, userID = ${userID}`);

        // The resolved instance may have been unloaded during the async join (Regular rooms unload when
        // empty), so revive the room and use the live instance.
        if (ServerRoomManager.roomRuntimeMemories[roomID] != roomRuntimeMemory)
        {
            const reloaded = await ServerRoomManager.loadRoom(roomID);
            if (!reloaded)
            {
                console.error(`ServerUserManager.addUserToRoom :: Room is no longer available (roomID = ${roomID})`);
                return undefined;
            }
            roomRuntimeMemory = reloaded;
        }

        if (roomRuntimeMemory.participantUserNameByID[userID] != undefined)
        {
            console.error(`ServerUserManager.addUserToRoom :: User is already registered (roomID = ${roomID}, userID = ${userID})`);
            return undefined;
        }
        ServerRoomManager.currentRoomIDByUserID[userID] = roomID;
        roomRuntimeMemory.participantUserNameByID[userID] = user.userName;

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerUserManager.addUserToRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.addSocketUserContext(userID, socketUserContext);

        // Create the user's player object. Stored metadata outlives a change of user type (e.g. a demoted
        // admin's prefs), so keys the user may no longer set are left out.
        const restoredMetadata: {[key: number]: EncodableByteString} = {};
        for (const key of Object.keys(playerMetadata))
        {
            const metadataKey = parseInt(key);
            if (!ObjectMetadataEntryMap.canUserSet(metadataKey, user))
                continue;
            restoredMetadata[metadataKey] = new EncodableByteString(playerMetadata[key]);
        }
        // The Helper is the agent the server runs itself, the one people are shown as an AI.
        if (user.userType == UserTypeEnumMap.Agent)
        {
            restoredMetadata[ObjectMetadataKeyEnumMap.AgentMark] = new EncodableByteString(
                (user.userName == HELPER_AGENT_NAME) ? "2" : "1");
        }
        const playerAddObjectSignal = new AddObjectSignal(
            roomID,
            user.id,
            user.userName,
            ObjectTypeConfigMap.getIndexByType("Player"),
            ServerObjectManager.generateNonPersistentObjectId(),
            playerObjectTransform,
            restoredMetadata
        );
        // The joining user is sent their player with the room, so only the others are told now.
        if (ServerObjectManager.addObjectAsServer(roomRuntimeMemory.room, user, playerAddObjectSignal, user.id))
            playerObjectByUserID[userID] = playerAddObjectSignal;
        return roomRuntimeMemory;
    },
    removeUserFromRoom: async (socketUserContext: UserContext, prevRoomShouldExist: boolean,
        savePlayerMetadata: boolean) =>
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

        // Snapshot metadata before removing the player, for reconnects that arrive before the DB write.
        const metadataSnapshot = savePlayerMetadata ? extractPlayerMetadata(user.id) : undefined;
        if (savePlayerMetadata && metadataSnapshot)
            recentDisconnectMetadata[user.id] = {metadata: metadataSnapshot, timestamp: Date.now()};

        const objectIds = getIdsOfNonPersistentObjectsSpawnedByUser(roomID, user.id);
        for (const objectId of objectIds)
        {
            ServerObjectManager.removeObjectAsServer(roomRuntimeMemory.room, user,
                new RemoveObjectSignal(roomRuntimeMemory.room.id, objectId), user.id);
        }

        if (roomRuntimeMemory.participantUserNameByID[user.id] == undefined)
        {
            console.error(`ServerUserManager.removeUserFromRoom :: User is not registered as the room's participant (userID = ${user.id}, roomID = ${roomID})`);
            return;
        }
        delete ServerRoomManager.currentRoomIDByUserID[user.id];
        delete roomRuntimeMemory.participantUserNameByID[user.id];
        delete playerObjectByUserID[user.id];

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerUserManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.removeSocketUserContext(user.id);

        // Persisted after releasing in-memory state; the buffer covers reconnects until the write lands.
        if (savePlayerMetadata && metadataSnapshot)
            await DBUserUtil.savePlayerMetadata(user.id, metadataSnapshot);

        // Regular rooms unload when empty.
        if (roomRuntimeMemory.room.roomType == RoomTypeEnumMap.Regular &&
            Object.keys(roomRuntimeMemory.participantUserNameByID).length == 0)
        {
            if (await DBRoomUtil.saveRoomContent(roomRuntimeMemory.room))
            {
                // Re-check emptiness: someone may have joined during the save.
                if (Object.keys(roomRuntimeMemory.participantUserNameByID).length == 0)
                    ServerRoomManager.unloadRoom(roomID);
            }
        }
    },
    // Current metadata from the live player object (for the shutdown batch save).
    getPlayerMetadata: (userID: string): {[key: string]: string} | undefined =>
    {
        return extractPlayerMetadata(userID);
    },
    consumeRecentDisconnectMetadata: (userID: string): {[key: string]: string} | undefined =>
    {
        const cached = recentDisconnectMetadata[userID];
        if (!cached) return undefined;
        delete recentDisconnectMetadata[userID];
        return cached.metadata;
    },
    evictExpiredDisconnectMetadata: (maxAgeMs: number): void =>
    {
        const now = Date.now();
        for (const [userID, cached] of Object.entries(recentDisconnectMetadata))
        {
            // `>=` so maxAgeMs 0 evicts everything (useful in tests).
            if (now - cached.timestamp >= maxAgeMs)
                delete recentDisconnectMetadata[userID];
        }
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
        for (const key in recentDisconnectMetadata)
            delete recentDisconnectMetadata[key];
    },
}

function extractPlayerMetadata(userID: string): {[key: string]: string} | undefined
{
    const playerObject = playerObjectByUserID[userID];
    if (!playerObject)
        return undefined;
    const raw = playerObject.metadata;
    const out: {[key: string]: string} = {};
    for (const key of Object.keys(raw))
        out[key] = raw[key as any].str;
    return out;
}

function getIdsOfNonPersistentObjectsSpawnedByUser(roomID: string, userID: string): string[]
{
    const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`getIdsOfNonPersistentObjectsSpawnedByUser :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return [];
    }
    const ids: string[] = [];
    for (const [objectId, obj] of Object.entries(roomRuntimeMemory.room.objectById))
    {
        if (obj.sourceUserID == userID)
        {
            const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
            if (!config.persistent)
                ids.push(objectId);
        }
    }
    return ids;
}

export default ServerUserManager;
