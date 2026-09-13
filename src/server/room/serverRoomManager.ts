import PhysicsManager from "../../shared/physics/physicsManager";
import Room from "../../shared/room/types/room";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../../shared/room/types/roomChangedSignal";
import RoomChangeRejectedSignal from "../../shared/room/types/roomChangeRejectedSignal";
import { RoomChangeRejectionReason, RoomChangeRejectionReasonEnumMap } from "../../shared/room/types/roomChangeRejectionReason";
import SocketUserContext from "../sockets/types/socketUserContext";
import SocketRoomContext from "../sockets/types/socketRoomContext";
import ServerUserManager from "../user/serverUserManager";
import DBRoomUtil from "../db/util/dbRoomUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import { HUB_ROOM_ID_KEYWORD, ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import SpawnHotspotUtil from "./util/spawnHotspotUtil";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import RoomTexturePackChangedSignal from "../../shared/room/types/roomTexturePackChangedSignal";
import RoomPrefsChangedSignal from "../../shared/room/types/roomPrefsChangedSignal";
import RoomPrefsUtil from "../../shared/room/util/roomPrefsUtil";
import ImageMapUtil from "../../shared/graphics/image/util/imageMapUtil";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import SinglePlayerModeConfigMap from "../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import VoxelGrid from "../../shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../shared/voxel/types/voxelQuadsRuntimeMemory";
import ObjectGroup from "../../shared/object/types/objectGroup";
import UserRoomChangeResult from "./types/userRoomChangeResult";
import RoomPickerUtil from "./util/roomPickerUtil";

const roomRuntimeMemories: {[roomID: string]: RoomRuntimeMemory} = {};
const socketRoomContexts: {[roomID: string]: SocketRoomContext} = {};
const currentRoomIDByUserID: {[userID: string]: string} = {};
const pendingLoads: {[roomID: string]: Promise<RoomRuntimeMemory | null>} = {};

const ServerRoomManager =
{
    roomRuntimeMemories,
    socketRoomContexts,
    currentRoomIDByUserID,
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
    saveMultiplayerRooms: async (force: boolean = false) =>
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
                    console.log(`ServerRoomManager.saveMultiplayerRooms :: Saved room (roomID = ${mem.room.id})`);
                }
                else
                    console.error(`ServerRoomManager.saveMultiplayerRooms :: Failed to save room (roomID = ${mem.room.id})`);
            }));
        }
    },
    // Batch-saves every connected user's player metadata (graceful shutdown).
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
    // destinationDoorLabel: the arrival door, when travelling through a door that names one.
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean,
        savePlayerMetadata: boolean, allowFallback: boolean,
        destinationDoorLabel: string = ""): Promise<UserRoomChangeResult> =>
    {
        const user = socketUserContext.user;
        console.log(`ServerRoomManager.changeUserRoom :: roomID = ${roomID}, userID = ${user.id}`);

        if (roomID == undefined) // (roomID == undefined) means "Do not add the user to any of the rooms". This scenario occurs usually when the user simply exits the app (i.e. disconnects from the server).
        {
            await leavePreviousRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
            return {type: "success", newRoomID: undefined};
        }

        // Empty ID = no destination could take the user (a refusal, not "leave the room").
        if (roomID.length == 0)
            return {type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomUnavailable};

        if (SinglePlayerModeConfigMap[roomID] != undefined) // User is joining a single-player room.
        {
            await leavePreviousRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
            socketUserContext.isInSinglePlayerRoom = true;
            const mem = buildSinglePlayerRoomRuntimeMemory(roomID);
            socketUserContext.addPendingSignalToUser("roomChangedSignal",
                new RoomChangedSignal(mem));
            return {type: "success", newRoomID: roomID};
        }

        // Vet the destination before leaving the current room, so a refusal leaves the user in place.
        // allowFallback: false for user-picked destinations (refuse), true for server-routed ones
        // (last room, URL; fall back to a hub).

        // In-memory rooms first; otherwise load from the DB.
        let roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            const mem = await ServerRoomManager.loadRoom(roomID);
            if (!mem)
            {
                console.error(`ServerRoomManager.changeUserRoom :: Failed to load room (ID = ${roomID})`);
                if (!allowFallback)
                    return {type: "error"};
                return await fallBackToHub(socketUserContext, prevRoomShouldExist, savePlayerMetadata,
                    RoomChangeRejectionReasonEnumMap.RoomUnavailable);
            }
            roomRuntimeMemory = mem;
        }

        // Player cap (mesh pools and performance). Re-entering one's own room isn't blocked by one's own slot.
        if (RoomPickerUtil.isRoomAlmostFull(roomRuntimeMemory) &&
            roomRuntimeMemory.participantUserNameByID[user.id] == undefined)
        {
            if (!allowFallback)
                return {type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull};
            return await fallBackToHub(socketUserContext, prevRoomShouldExist, savePlayerMetadata,
                RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull);
        }

        // The destination has been vetted, so the user can now give up their current room.
        await leavePreviousRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);

        // Metadata resolution: (1) the recent-disconnect buffer (bridges an unfinished DB write),
        // (2) DBUser.playerMetadata, (3) empty.
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

        // Joins during the async lookup above could fill the room; the "almost full" margin covers this.

        // Multiplayer only (single-player players are client-side). The joined instance is whichever
        // is live at registration (see addUserToRoom).
        socketUserContext.isInSinglePlayerRoom = false;
        const joinedRoomRuntimeMemory = await ServerUserManager.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            SpawnHotspotUtil.pickSpawnTransform(roomRuntimeMemory.room, destinationDoorLabel),
            playerMetadata
        );
        if (!joinedRoomRuntimeMemory)
            return {type: "error"};

        // Persist the last room (single-player rooms are re-entered via singlePlayerMode instead).
        DBUserUtil.setLastRoomID(user.id, roomID).catch(err =>
            console.error(`ServerRoomManager.changeUserRoom :: setLastRoomID failed for userID = ${user.id}: ${err}`)
        );

        // Sent directly to the user's socket context, since single-player users aren't registered in
        // the room context.
        const roomChangedSignal = new RoomChangedSignal(joinedRoomRuntimeMemory);
        socketUserContext.addPendingSignalToUser("roomChangedSignal", roomChangedSignal);
        return {type: "success", newRoomID: roomID};
    },
    // An empty room ID or the hub keyword is resolved by the picker (hub load changes over time, so doors
    // name the keyword rather than a hub). Picker-chosen hubs allow fallback.
    onRequestRoomChangeSignalReceived: async (socketUserContext: SocketUserContext, params: RequestRoomChangeSignal): Promise<void> =>
    {
        let roomID = params.roomID;
        let allowFallback = params.allowFallback;
        if (!roomID || roomID.length == 0)
            roomID = await RoomPickerUtil.pickBestRoomID(socketUserContext, "requestFromUser");
        else if (roomID == HUB_ROOM_ID_KEYWORD)
        {
            roomID = await RoomPickerUtil.pickBestHubRoomID();
            allowFallback = true;
        }
        const result = await ServerRoomManager.changeUserRoom(socketUserContext,
            roomID, true, true, allowFallback, params.destinationDoorLabel);
        ServerRoomManager.notifyRoomChangeRejection(socketUserContext, result);
    },
    // Releases the client's loading block with a reason. No-op on success (RoomChangedSignal covers that).
    notifyRoomChangeRejection: (socketUserContext: SocketUserContext, result: UserRoomChangeResult): void =>
    {
        if (result.type == "success")
            return;
        const reason = (result.type == "rejected")
            ? result.reason
            : RoomChangeRejectionReasonEnumMap.RoomUnavailable;
        socketUserContext.addPendingSignalToUser("roomChangeRejectedSignal",
            new RoomChangeRejectedSignal(reason));
    },
    // Canonicalizes prefs via a RoomPrefsUtil round trip (decode is total, encode clamps) before
    // storing and broadcasting.
    changeRoomPrefs: async (room: Room, newPrefs: string): Promise<boolean> =>
    {
        const canonicalPrefs = RoomPrefsUtil.encode(RoomPrefsUtil.decode(newPrefs));

        const success = await DBRoomUtil.changeRoomPrefs(room, canonicalPrefs);
        if (!success)
            return false;

        const roomRuntimeMemory = roomRuntimeMemories[room.id];
        if (roomRuntimeMemory)
            roomRuntimeMemory.room.prefs = canonicalPrefs;

        const socketRoomContext = socketRoomContexts[room.id];
        if (socketRoomContext)
        {
            const signal = new RoomPrefsChangedSignal(room.id, canonicalPrefs);
            socketRoomContext.multicastSignal("roomPrefsChangedSignal", signal);
        }

        return true;
    },
    changeRoomTexturePack: async (room: Room, newTexturePackPath: string): Promise<boolean> =>
    {
        if (!ImageMapUtil.getImageMap("VoxelTexturePackImageMap").hasImagePath(newTexturePackPath))
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
}

// Routes a user whose destination was unusable to a hub with space; the reason is reported if none can.
async function fallBackToHub(socketUserContext: SocketUserContext, prevRoomShouldExist: boolean,
    savePlayerMetadata: boolean, rejectionReason: RoomChangeRejectionReason): Promise<UserRoomChangeResult>
{
    const fallbackRoomID = await RoomPickerUtil.pickBestHubRoomID();
    console.warn(`ServerRoomManager :: Original destination is unusable. Falling back to -> roomID = ${fallbackRoomID} (userID = ${socketUserContext.user.id})`);
    if (fallbackRoomID.length == 0)
        return {type: "rejected", reason: rejectionReason};
    return await ServerRoomManager.changeUserRoom(socketUserContext, fallbackRoomID,
        prevRoomShouldExist, savePlayerMetadata, false);
}

// Removes the user from their current room (never from single-player rooms, which they were never added to).
async function leavePreviousRoom(socketUserContext: SocketUserContext,
    prevRoomShouldExist: boolean, savePlayerMetadata: boolean): Promise<void>
{
    if (socketUserContext.isInSinglePlayerRoom)
        return;
    await ServerUserManager.removeUserFromRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
}

// A transient, content-less RoomRuntimeMemory for a single-player room: not stored, no physics world;
// id and name are the mode. The client generates the content (see Room.encode).
function buildSinglePlayerRoomRuntimeMemory(mode: string): RoomRuntimeMemory
{
    // Texture pack left empty; the client sets it while building the room.
    const room = new Room(mode /*id*/, mode /*roomName*/, RoomTypeEnumMap.SinglePlayer,
        "", "", "" /*texturePackPath*/, RoomPrefsUtil.getDefaultPrefsString(),
        new VoxelGrid([], new VoxelQuadsRuntimeMemory()),
        new ObjectGroup([]));
    return new RoomRuntimeMemory(room, {});
}

async function _loadRoom(roomID: string): Promise<RoomRuntimeMemory | null>
{
    const room = await DBRoomUtil.getRoomContent(roomID);
    if (!room)
        return null;

    const roomRuntimeMemory = new RoomRuntimeMemory(room, {});
    ServerRoomManager.roomRuntimeMemories[roomID] = roomRuntimeMemory;
    ServerRoomManager.socketRoomContexts[roomID] = new SocketRoomContext();

    PhysicsManager.load(roomRuntimeMemory);
    return roomRuntimeMemory;
}

// Periodic multiplayer room saving. Unref'd so it never keeps the process alive (e.g. the SSG run);
// shutdown saves explicitly.
let savingInProgress = false;
setInterval(async () => {
    if (savingInProgress)
        return;
    savingInProgress = true;
    await ServerRoomManager.saveMultiplayerRooms();
    savingInProgress = false;
}, 3000).unref();

export default ServerRoomManager;
