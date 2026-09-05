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
import { ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import SpawnHotspotUtil from "./util/spawnHotspotUtil";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import RoomTexturePackChangedSignal from "../../shared/room/types/roomTexturePackChangedSignal";
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
    // "destinationDoorLabel" names the door of the destination room the user means to arrive behind,
    // if he came through a door that pointed at one. Everything else — a room picked from a list, a
    // room the server routed him to — names none, and lands wherever the room's own way in is.
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

        // An empty room ID means a destination was wanted but none could be found (i.e. every
        // room that could have taken this user is full). That is a refusal, not a request to
        // leave the user roomless, so it must not be mistaken for the case above.
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

        // Everything from here down to the point where the user actually leaves their current
        // room is about vetting the destination. Doing it in that order is what makes a refusal
        // harmless: a user turned away from a full room stays exactly where they were, instead
        // of being stranded in no room at all.
        //
        // "allowFallback" separates the two kinds of destination a user can end up with: one
        // they picked by name (fallback NOT allowed — if it can't be entered, they are simply
        // turned away) and one the server routed them to, such as the room from their last
        // session or a room ID carried in the URL (fallback allowed — an unusable destination
        // sends them to a hub instead of leaving them roomless).

        // Check in-memory multiplayer rooms first to avoid a Firestore query.
        // If the in-memory instance is unavailable, load it from the DB.
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

        // Every room holds a limited number of players, both to keep the client's per-room
        // instanced-mesh pool from running dry and to stop one room from degrading everyone's
        // performance.
        // (A user re-entering the room they are already in is not blocked by their own slot,
        // since they release it on the way in.)
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

        // Theoretically, it is possible for other users to have joined the room
        // during the preceding DBUser lookup process (which is very brief but nevertheless
        // asynchronous), thereby resulting in the room becoming full AFTER it was decided
        // that it was not full yet and thus safe for the user to enter.
        // However, since our initial check was based on the
        // "Almost Full" (instead of just "Full") condition which includes a
        // margin to take account of this potential race condition, we are probably safe here.

        // Add the user to the multiplayer room.
        // (In case of a singleplayer room, the user's player object will be added/handled directly by the client.)
        // The room the user actually lands in is whichever instance was live at registration time,
        // which is not necessarily the one resolved above (see addUserToRoom).
        socketUserContext.isInSinglePlayerRoom = false;
        const joinedRoomRuntimeMemory = await ServerUserManager.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            SpawnHotspotUtil.pickSpawnTransform(roomRuntimeMemory.room, destinationDoorLabel),
            playerMetadata
        );
        if (!joinedRoomRuntimeMemory)
            return {type: "error"};

        // Persist the user's latest room to DBUser, so that the user will come back to the same room when reconnected.
        // (A singleplayer room is not meant to be revisited based on the user's lastRoomID. It will be visited based on the user's singlePlayerMode.)
        DBUserUtil.setLastRoomID(user.id, roomID).catch(err =>
            console.error(`ServerRoomManager.changeUserRoom :: setLastRoomID failed for userID = ${user.id}: ${err}`)
        );

        // Wrap the room memory in a RoomChangedSignal and send it to the joining user.
        // The signal goes straight to the user's own socket context rather than being routed through
        // the room's SocketRoomContext: a single-player user is intentionally never registered in the
        // room context (see above), so an indirect unicast would fail to find them. Since this is a
        // pure unicast to the joining user, the direct path is equivalent for multiplayer rooms too.
        const roomChangedSignal = new RoomChangedSignal(joinedRoomRuntimeMemory);
        socketUserContext.addPendingSignalToUser("roomChangedSignal", roomChangedSignal);
        return {type: "success", newRoomID: roomID};
    },
    onRequestRoomChangeSignalReceived: async (socketUserContext: SocketUserContext, params: RequestRoomChangeSignal): Promise<void> =>
    {
        let roomID = params.roomID;
        if (!roomID || roomID.length == 0) // If roomID is not specified, pick the best one.
            roomID = await RoomPickerUtil.pickBestRoomID(socketUserContext, "requestFromUser");
        const result = await ServerRoomManager.changeUserRoom(socketUserContext,
            roomID, true, true, params.allowFallback, params.destinationDoorLabel);
        ServerRoomManager.notifyRoomChangeRejection(socketUserContext, result);
    },
    // Tells the user that the room change they were waiting for is not going to happen, so
    // that their client can stop blocking on it and show the reason instead. Does nothing for
    // a successful room change, which the user learns about through the RoomChangedSignal.
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

// Sends a user whose intended destination turned out to be unusable to a hub that still has
// room for them, so they are never left without a room to be in. The rejection reason is what
// the user is told when even that is impossible (i.e. no hub can take another player).
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

// Removes the user from the room they are currently in (if any).
// A single-player environment is skipped: a user never gets added to one, so they are never
// meant to be removed from one either.
async function leavePreviousRoom(socketUserContext: SocketUserContext,
    prevRoomShouldExist: boolean, savePlayerMetadata: boolean): Promise<void>
{
    if (socketUserContext.isInSinglePlayerRoom)
        return;
    await ServerUserManager.removeUserFromRoom(socketUserContext, prevRoomShouldExist, savePlayerMetadata);
}

// Builds a transient, content-less RoomRuntimeMemory for a single-player room. It is intentionally
// NOT stored in roomRuntimeMemories and gets no server-side PhysicsManager world: the client owns
// and regenerates the room's voxels/objects locally, so the server only needs an identity (the
// id/name both equal the single-player mode). Content is omitted on the wire too (see Room.encode).
function buildSinglePlayerRoomRuntimeMemory(mode: string): RoomRuntimeMemory
{
    // The texture pack is left empty along with the rest of the content. It is part of what the
    // room is built out of rather than part of its identity, so the client settles it as it builds
    // the room, before anything reads it — a value stamped here would only ever be overwritten.
    const room = new Room(mode /*id*/, mode /*roomName*/, RoomTypeEnumMap.SinglePlayer,
        "", "", "" /*texturePackPath*/,
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

// periodic multiplayer room saving
//
// Unref'd, so that this timer is never itself a reason for the process to stay alive: there are no
// rooms to save in a process that has nothing else left to do, and this module is reached from the
// server's entry point in every mode — including the one-shot static-site generation run, which
// would otherwise never end. While the server is actually serving, the listening socket keeps the
// loop alive and this timer fires exactly as before; shutdown saves the rooms explicitly rather
// than relying on a final tick here.
let savingInProgress = false;
setInterval(async () => {
    if (savingInProgress)
        return;
    savingInProgress = true;
    await ServerRoomManager.saveMultiplayerRooms();
    savingInProgress = false;
}, 3000).unref();

export default ServerRoomManager;
