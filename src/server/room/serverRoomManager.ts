import PhysicsManager from "../../shared/physics/physicsManager";
import Room from "../../shared/room/types/room";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../../shared/room/types/roomChangedSignal";
import ObjectTransform from "../../shared/object/types/objectTransform";
import SocketUserContext from "../sockets/types/socketUserContext";
import SocketRoomContext from "../sockets/types/socketRoomContext";
import ServerUserManager from "../user/serverUserManager";
import DBRoomUtil from "../db/util/dbRoomUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import { ENTRANCE_DIRECTION, ENTRANCE_POSITION, ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import RoomTexturePackChangedSignal from "../../shared/room/types/roomTexturePackChangedSignal";
import ImageMapUtil from "../../shared/image/util/imageMapUtil";
import DBRoomEditor from "../db/types/row/dbRoomEditor";
import { MAX_ROOM_EDITORS } from "../system/serverConstants";

const roomRuntimeMemories: {[roomID: string]: RoomRuntimeMemory} = {};
const socketRoomContexts: {[roomID: string]: SocketRoomContext} = {};
const currentRoomIDByUserID: {[userID: string]: string} = {};
const pendingLoads: {[roomID: string]: Promise<RoomRuntimeMemory | null>} = {};
// Per-room editor table (denormalized {userID, userName, email} entries).
// Loaded from DBRoom.editors when the room is loaded; mutated in lockstep with
// DBRoom.editors via setRoomEditor/removeRoomEditor below.
const editorsByRoomID: {[roomID: string]: DBRoomEditor[]} = {};

const ServerRoomManager =
{
    roomRuntimeMemories,
    socketRoomContexts,
    currentRoomIDByUserID,
    editorsByRoomID,
    loadRoom: async (roomID: string): Promise<RoomRuntimeMemory | null> =>
    {
        console.log(`ServerRoomManager.loadRoom :: roomID = ${roomID}`);
        if (ServerRoomManager.roomRuntimeMemories[roomID] != undefined)
            return ServerRoomManager.roomRuntimeMemories[roomID];

        if (pendingLoads[roomID] != undefined)
            return pendingLoads[roomID];

        pendingLoads[roomID] = _loadRoom(roomID);
        try
        {
            return await pendingLoads[roomID];
        }
        finally
        {
            delete pendingLoads[roomID];
        }
    },
    unloadRoom: (roomID: string) =>
    {
        console.log(`ServerRoomManager.unloadRoom :: roomID = ${roomID}`);
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (ServerRoomManager.roomRuntimeMemories[roomID] == undefined)
            throw new Error(`ServerRoomManager.unloadRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        if (Object.keys(roomRuntimeMemory.participantUserNameByID).length > 0)
            throw new Error(`ServerRoomManager.unloadRoom :: There are still participants in the room (participantUserNameByID = [${JSON.stringify(roomRuntimeMemory.participantUserNameByID)}])`);
        delete ServerRoomManager.roomRuntimeMemories[roomID];
        delete ServerRoomManager.socketRoomContexts[roomID];
        delete editorsByRoomID[roomID];

        PhysicsManager.unload(roomID);
    },
    getRoom: (socketUserContext: SocketUserContext): Room | undefined =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        if (roomID == undefined)
        {
            console.error(`getRoom :: RoomID not found (userID = ${user.id})`);
            return undefined;
        }
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`getRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return undefined;
        }
        return roomRuntimeMemory.room;
    },
    saveRooms: async (force: boolean = false) =>
    {
        const currTimeInMillis = Date.now();
        const roomsToSave: RoomRuntimeMemory[] = [];
        for (const roomRuntimeMemory of Object.values(roomRuntimeMemories))
        {
            if (roomRuntimeMemory.room.dirty &&
                (force || currTimeInMillis >= roomRuntimeMemory.lastSavedTimeInMillis + ROOM_AUTO_SAVE_INTERVAL))
            {
                roomsToSave.push(roomRuntimeMemory);
            }
        }

        const BATCH_SIZE = 5;
        for (let i = 0; i < roomsToSave.length; i += BATCH_SIZE)
        {
            await Promise.all(roomsToSave.slice(i, i + BATCH_SIZE).map(async (mem) =>
            {
                const success = await DBRoomUtil.saveRoomContent(mem.room);
                if (success)
                {
                    mem.lastSavedTimeInMillis = Date.now();
                    mem.room.dirty = false;
                    console.log(`ServerRoomManager.saveRooms :: Saved room (roomID = ${mem.room.id})`);
                }
                else
                    console.error(`ServerRoomManager.saveRooms :: Failed to save room (roomID = ${mem.room.id})`);
            }));
        }
    },
    // Flushes every connected user's latest player metadata to DBUser in one batched query.
    // Called by graceful shutdown so that the next-session data is preserved.
    saveAllUsersPlayerMetadata: async (socketUserContextsByUserID: {[userID: string]: SocketUserContext}) =>
    {
        const updates: Array<{userID: string; playerMetadata: {[key: string]: string}}> = [];

        for (const userID of Object.keys(socketUserContextsByUserID))
        {
            const metadata = ServerUserManager.getPlayerMetadata(userID);
            if (!metadata) continue;
            updates.push({ userID, playerMetadata: metadata });
        }
        await DBUserUtil.saveMultipleUsersPlayerMetadata(updates);
    },
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean,
        savePlayerMetadata: boolean): Promise<boolean> =>
    {
        const user = socketUserContext.user;
        console.log(`ServerRoomManager.changeUserRoom :: roomID = ${roomID}, userID = ${user.id}`);
        await ServerUserManager.removeUserFromRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
        if (!roomID)
            return false;

        let roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            const mem = await ServerRoomManager.loadRoom(roomID);
            if (mem)
                roomRuntimeMemory = mem;
        }
        if (!roomRuntimeMemory)
        {
            console.error(`Failed to load room (ID = ${roomID})`);
            return false;
        }

        // Player metadata is per-user (stored on DBUser), so it follows the user
        // across rooms. Resolution order:
        //   1. The recentDisconnectMetadata buffer on ServerUserManager — populated
        //      synchronously by the previous session's removeUserFromRoom, so it
        //      bridges the gap where the disconnect's DBUser write has not yet landed.
        //   2. DBUser.playerMetadata — the persistent fallback (the buffer was either
        //      never populated, or already evicted by TTL).
        //   3. Empty object — brand-new user with no chat history.
        let playerMetadata: {[key: string]: string} = {};
        const consumed = ServerUserManager.consumeRecentDisconnectMetadata(user.id);
        if (consumed)
            playerMetadata = consumed;
        else
        {
            const dbUser = await DBUserUtil.findUserById(user.id);
            if (dbUser && dbUser.playerMetadata)
                playerMetadata = dbUser.playerMetadata;
        }

        // userRole is derived from the room's editor list (loaded with the room)
        // plus the room's ownerUserID. Owner takes precedence.
        let userRole: UserRole = UserRoleEnumMap.Visitor;
        const editors = editorsByRoomID[roomID];
        if (editors && editors.some(e => e.userID === user.id))
            userRole = UserRoleEnumMap.Editor;
        if (roomRuntimeMemory.room.ownerUserID === user.id)
            userRole = UserRoleEnumMap.Owner;

        ServerUserManager.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            new ObjectTransform({...ENTRANCE_POSITION}, {...ENTRANCE_DIRECTION}),
            playerMetadata, userRole
        );

        // Persist the user's current room to DBUser. This is the only durable signal
        // we need for "where should this user land on next login" — there is no
        // longer a separate gameplay-state save path.
        DBUserUtil.setLastRoomID(user.id, roomID).catch(err =>
            console.error(`ServerRoomManager.changeUserRoom :: setLastRoomID failed for userID = ${user.id}: ${err}`)
        );

        // Wrap the room memory and user role in a RoomChangedSignal and unicast to the joining user.
        const roomChangedSignal = new RoomChangedSignal(roomRuntimeMemory, userRole);
        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`ServerRoomManager.changeUserRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else // Send the room data to the user who is added to the room.
            socketRoomContext.unicastSignal("roomChangedSignal", roomChangedSignal, user.id);
        return true;
    },
    onRequestRoomChangeSignalReceived: async (socketUserContext: SocketUserContext, params: RequestRoomChangeSignal): Promise<void> =>
    {
        await ServerRoomManager.changeUserRoom(socketUserContext, params.roomID, true, true);
    },
    changeRoomTexturePack: async (room: Room, newTexturePackPath: string): Promise<boolean> =>
    {
        if (!ImageMapUtil.getImageMap("TexturePackImageMap").hasImagePath(newTexturePackPath))
            return false;

        const success = await DBRoomUtil.changeRoomTexturePackPath(room, newTexturePackPath);
        if (!success)
            return false;

        const roomRuntimeMemory = roomRuntimeMemories[room.id];
        if (roomRuntimeMemory)
            roomRuntimeMemory.room.texturePackPath = newTexturePackPath;

        const socketRoomContext = socketRoomContexts[room.id];
        if (socketRoomContext)
        {
            const signal = new RoomTexturePackChangedSignal(room.id, newTexturePackPath);
            socketRoomContext.multicastSignal("roomTexturePackChangedSignal", signal);
        }

        return true;
    },
    // Adds or refreshes an editor entry on the room. Works whether or not the
    // room is currently loaded: the DB is the source of truth, and the in-memory
    // editor list is updated when the room is loaded.
    // Refreshing an existing editor is always allowed; adding a NEW editor is
    // rejected with "limit-reached" once the room is at MAX_ROOM_EDITORS.
    setRoomEditor: async (roomID: string, editor: DBRoomEditor): Promise<"success" | "limit-reached" | "error"> =>
    {
        const current = await loadCurrentEditors(roomID);
        if (!current) return "error";
        const idx = current.findIndex(e => e.userID === editor.userID);
        if (idx >= 0)
            current[idx] = editor;
        else
        {
            if (current.length >= MAX_ROOM_EDITORS)
                return "limit-reached";
            current.push(editor);
        }
        const success = await DBRoomUtil.setEditors(roomID, current);
        if (success && editorsByRoomID[roomID])
            editorsByRoomID[roomID] = current;
        return success ? "success" : "error";
    },
    removeRoomEditor: async (roomID: string, userID: string): Promise<boolean> =>
    {
        const current = await loadCurrentEditors(roomID);
        if (!current) return false;
        const filtered = current.filter(e => e.userID !== userID);
        if (filtered.length === current.length)
            return true; // no-op
        const success = await DBRoomUtil.setEditors(roomID, filtered);
        if (success && editorsByRoomID[roomID])
            editorsByRoomID[roomID] = filtered;
        return success;
    },
    getRoomEditors: async (roomID: string): Promise<DBRoomEditor[]> =>
    {
        return (await loadCurrentEditors(roomID)) ?? [];
    },
}

// Returns the room's current editor list, preferring the in-memory copy (loaded
// rooms) and falling back to a DB read (unloaded rooms). Returns null only when
// the room doesn't exist in either place.
async function loadCurrentEditors(roomID: string): Promise<DBRoomEditor[] | null>
{
    const cached = editorsByRoomID[roomID];
    if (cached) return [...cached];
    const dbRoom = await DBRoomUtil.getDBRoom(roomID);
    if (!dbRoom) return null;
    return dbRoom.editors ?? [];
}

async function _loadRoom(roomID: string): Promise<RoomRuntimeMemory | null>
{
    // Load room content + DB metadata in parallel — they're independent.
    // Editors live on DBRoom (NOT in the binary content blob), so we need both.
    const [room, dbRoom] = await Promise.all([
        DBRoomUtil.getRoomContent(roomID),
        DBRoomUtil.getDBRoom(roomID),
    ]);
    if (!room)
        return null;

    const roomRuntimeMemory = new RoomRuntimeMemory(room, {});
    ServerRoomManager.roomRuntimeMemories[roomID] = roomRuntimeMemory;
    ServerRoomManager.socketRoomContexts[roomID] = new SocketRoomContext();
    editorsByRoomID[roomID] = dbRoom?.editors ?? [];

    PhysicsManager.load(roomRuntimeMemory);
    return roomRuntimeMemory;
}

// periodic room saving
let savingInProgress = false;
setInterval(async () => {
    if (savingInProgress)
        return;
    savingInProgress = true;
    await ServerRoomManager.saveRooms();
    savingInProgress = false;
}, 3000);

export default ServerRoomManager;
