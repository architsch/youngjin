import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import EncodableByteString from "../../shared/networking/types/encodableByteString";
import ObjectTransform from "../../shared/object/types/objectTransform";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerObjectManager from "../object/serverObjectManager";
import DBRoomUtil from "../db/util/dbRoomUtil";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import SetUserRoleSignal from "../../shared/user/types/setUserRoleSignal";
import DBUserUtil from "../db/util/dbUserUtil";
import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";

const socketUserContexts: {[userID: string]: SocketUserContext} = {};
const playerObjectByUserID: {[userID: string]: AddObjectSignal} = {};
const userRoleByUserID: {[userID: string]: UserRole} = {};

// Short-lived per-user buffer of the last known player metadata at disconnect time.
// When a user reconnects before the disconnect's DBUser write has landed (the race
// window for case 1 of the user-state-management flow), this buffer is consulted
// before falling back to DBUser so the rebuilt player object still carries the
// user's latest chat message etc.
// Entries are evicted on the next successful reconnect, or via TTL (handled by
// SocketsServer's periodic stale-socket sweep).
const recentDisconnectMetadata: {[userID: string]: {metadata: {[key: string]: string}; timestamp: number}} = {};

const ServerUserManager =
{
    socketUserContexts,
    recentDisconnectMetadata,
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
        if (roomRuntimeMemory.participantUserNameByID[userID] != undefined)
        {
            console.error(`ServerUserManager.addUserToRoom :: User is already registered (roomID = ${roomRuntimeMemory.room.id}, userID = ${userID})`);
            return;
        }
        ServerRoomManager.currentRoomIDByUserID[userID] = roomRuntimeMemory.room.id;
        roomRuntimeMemory.participantUserNameByID[userID] = user.userName;

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
            ServerObjectManager.generateNonPersistentObjectId(),
            playerObjectTransform,
            restoredMetadata
        );
        if (ServerObjectManager.onAddObjectSignalReceived(socketUserContext, playerAddObjectSignal))
            playerObjectByUserID[userID] = playerAddObjectSignal;
        userRoleByUserID[userID] = userRole;
    },
    removeUserFromRoom: async (socketUserContext: SocketUserContext, prevRoomShouldExist: boolean,
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

        // Snapshot the player metadata BEFORE removing the player object, so that a
        // reconnect arriving in the gap between this point and the DB write below
        // can still read the user's latest chat message etc. from the in-memory
        // buffer rather than seeing a stale DBUser document.
        const metadataSnapshot = savePlayerMetadata ? extractPlayerMetadata(user.id) : undefined;
        if (savePlayerMetadata && metadataSnapshot)
            recentDisconnectMetadata[user.id] = {metadata: metadataSnapshot, timestamp: Date.now()};

        const objectIds = getIdsOfNonPersistentObjectsSpawnedByUser(roomID, user.id);
        for (const objectId of objectIds)
            ServerObjectManager.onRemoveObjectSignalReceived(socketUserContext, new RemoveObjectSignal(roomRuntimeMemory.room.id, objectId));

        if (roomRuntimeMemory.participantUserNameByID[user.id] == undefined)
        {
            console.error(`ServerUserManager.removeUserFromRoom :: User is not registered as the room's participant (userID = ${user.id}, roomID = ${roomID})`);
            return;
        }
        delete ServerRoomManager.currentRoomIDByUserID[user.id];
        delete roomRuntimeMemory.participantUserNameByID[user.id];
        delete playerObjectByUserID[user.id];
        delete userRoleByUserID[user.id];

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerUserManager.removeUserFromRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.removeSocketUserContext(user.id);

        // Persist the metadata snapshot AFTER releasing in-memory state, so the
        // reconnect path (which checks recentDisconnectMetadata first) always sees
        // a consistent view. If the DB write completes before the reconnect,
        // DBUser is the source of truth; otherwise, the buffer covers the gap.
        if (savePlayerMetadata && metadataSnapshot)
            await DBUserUtil.savePlayerMetadata(user.id, metadataSnapshot);

        if (roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer &&
            Object.keys(roomRuntimeMemory.participantUserNameByID).length == 0)
        {
            if (await DBRoomUtil.saveRoomContent(roomRuntimeMemory.room))
            {
                // Check once again to see if there is any user in the room,
                // before proceeding to unload the room. The reason why this check is necessary
                // is that a user might have joined the room WHILE we were saving the
                // room's content to the DB (by the async "DBRoomUtil.saveRoomContent" call above).
                if (Object.keys(roomRuntimeMemory.participantUserNameByID).length == 0)
                    ServerRoomManager.unloadRoom(roomID);
            }
        }
    },
    // Returns a snapshot of the user's current player metadata (read from the live
    // player object). Used by graceful-shutdown to flush all connected users in one
    // batch query.
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
            // `>=` (not `>`) so a maxAgeMs of 0 evicts everything synchronously,
            // which makes test setup straightforward.
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
        for (const key in userRoleByUserID)
            delete userRoleByUserID[key];
        for (const key in recentDisconnectMetadata)
            delete recentDisconnectMetadata[key];
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
