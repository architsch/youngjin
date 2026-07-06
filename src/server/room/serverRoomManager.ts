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
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, PLAYER_HEIGHT, ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import RoomTexturePackChangedSignal from "../../shared/room/types/roomTexturePackChangedSignal";
import ImageMapUtil from "../../shared/graphics/image/util/imageMapUtil";
import DBRoomEditor from "../db/types/row/dbRoomEditor";
import { MAX_ROOM_EDITORS } from "../system/serverConstants";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import DBSearchUtil from "../db/util/dbSearchUtil";
import SinglePlayerModeConfigMap from "../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import VoxelGrid from "../../shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../shared/voxel/types/voxelQuadsRuntimeMemory";
import ObjectGroup from "../../shared/object/types/objectGroup";

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

        // "hub" is a special keyword which means that the user wants to join whichever Hub-type room is available.
        if (roomID == "hub")
        {
            // Search for a hub among the already loaded rooms.
            for (const roomRuntimeMemory of Object.values(ServerRoomManager.roomRuntimeMemories))
            {
                if (roomRuntimeMemory.room.roomType == RoomTypeEnumMap.Hub)
                    return roomRuntimeMemory;
            }
            // If no hub is currently loaded, load one.
            const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
            if (roomSearchResult.success && roomSearchResult.data.length > 0)
            {
                // If there are multiple hub rooms, choose a random one of them
                // (This will help distribute the user traffic evenly).
                roomID = roomSearchResult.data[Math.floor(Math.random() * roomSearchResult.data.length)].id as string;
            }
            else
                return null;
        }

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
            if (roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer &&
                roomRuntimeMemory.room.dirty &&
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
        
        // Remove the user from the previous room (if applicable).
        // However, don't attempt to remove the user if the previous room was a single-player environment.
        // A user never gets added to a single-player environment, so he/she is never meant to be removed from one either.
        if (!socketUserContext.isInSinglePlayerRoom)
            await ServerUserManager.removeUserFromRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
        
        if (!roomID)
            return false;

        // Single-player rooms (e.g. the tutorial) are client-generated shared templates: the room's
        // ID equals its single-player mode, which is a key in SinglePlayerModeConfigMap. We never
        // load or cache such a room server-side — we synthesize a transient, content-less descriptor
        // (the client builds the actual voxels/objects locally) and hand it straight to the joining
        // user. The user is deliberately NOT registered as a participant, given no role beyond
        // Visitor, and has no last-room written, matching the "server isn't authoritative over
        // single-player" contract.
        if (SinglePlayerModeConfigMap[roomID] != undefined)
        {
            socketUserContext.isInSinglePlayerRoom = true;
            const mem = buildSinglePlayerRoomRuntimeMemory(roomID);
            socketUserContext.addPendingSignalToUser("roomChangedSignal",
                new RoomChangedSignal(mem, UserRoleEnumMap.Visitor));
            return true;
        }

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

        // Add the user to the room.
        // (In case of a singleplayer room, the user's player object will be added/handled directly by the client.)
        if (roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            socketUserContext.isInSinglePlayerRoom = false;
            ServerUserManager.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
                new ObjectTransform(
                    {x: MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: 0.5 * PLAYER_HEIGHT, z: MULTI_PLAYER_ENTRANCE_VOXEL_ROW + 0.5},
                    {x: 0, y: 0, z: 1}
                ),
                playerMetadata, userRole
            );
        }
        else // If the user is joining a singleplayer room, mark him/her as so for future reference.
            socketUserContext.isInSinglePlayerRoom = true;

        // Persist the user's latest room to DBUser, so that the user will come back to the same room when reconnected.
        // (A singleplayer room is not meant to be revisited based on the user's lastRoomID. It will be visited based on the user's singlePlayerMode.)
        if (roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            DBUserUtil.setLastRoomID(user.id, roomID).catch(err =>
                console.error(`ServerRoomManager.changeUserRoom :: setLastRoomID failed for userID = ${user.id}: ${err}`)
            );
        }

        // Wrap the room memory and user role in a RoomChangedSignal and send it to the joining user.
        // The signal goes straight to the user's own socket context rather than being routed through
        // the room's SocketRoomContext: a single-player user is intentionally never registered in the
        // room context (see above), so an indirect unicast would fail to find them. Since this is a
        // pure unicast to the joining user, the direct path is equivalent for multiplayer rooms too.
        const roomChangedSignal = new RoomChangedSignal(roomRuntimeMemory, userRole);
        socketUserContext.addPendingSignalToUser("roomChangedSignal", roomChangedSignal);
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

// Builds a transient, content-less RoomRuntimeMemory for a single-player room. It is intentionally
// NOT stored in roomRuntimeMemories and gets no server-side PhysicsManager world: the client owns
// and regenerates the room's voxels/objects locally, so the server only needs an identity (the
// id/name both equal the single-player mode). Content is omitted on the wire too (see Room.encode).
function buildSinglePlayerRoomRuntimeMemory(mode: string): RoomRuntimeMemory
{
    const room = new Room(mode /*id*/, mode /*roomName*/, RoomTypeEnumMap.SinglePlayer,
        "", "", "default",
        new VoxelGrid([], new VoxelQuadsRuntimeMemory()),
        new ObjectGroup([]));
    return new RoomRuntimeMemory(room, {});
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
