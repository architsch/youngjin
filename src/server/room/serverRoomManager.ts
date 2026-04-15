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
import DBUserRoomStateUtil from "../db/util/dbUserRoomStateUtil";
import { PLAYER_HEIGHT, ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import UserGameplayState from "../user/types/userGameplayState";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";

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
        if (Object.keys(roomRuntimeMemory.participantUserIDs).length > 0)
            throw new Error(`ServerRoomManager.unloadRoom :: There are still participants in the room (participants = [${JSON.stringify(roomRuntimeMemory.participantUserIDs)}])`);
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
    saveAllUserGameplayStates: async (socketUserContextsByUserID: {[userID: string]: SocketUserContext}) =>
    {
        const gameplayStates: UserGameplayState[] = [];

        for (const [userID, roomID] of Object.entries(currentRoomIDByUserID))
        {
            const roomRuntimeMemory = roomRuntimeMemories[roomID];
            if (!roomRuntimeMemory)
            {
                console.error(`ServerRoomManager.saveAllUserGameplayStates :: RoomRuntimeMemory not found (roomID = ${roomID})`);
                continue;
            }
            const socketUserContext = socketUserContextsByUserID[userID];
            if (!socketUserContext)
            {
                console.error(`ServerRoomManager.saveAllUserGameplayStates :: SocketUserContext not found (userID = ${userID})`);
                continue;
            }
            const gameplayState = ServerUserManager.getUserGameplayState(socketUserContext, roomRuntimeMemory);
            if (gameplayState)
                gameplayStates.push(gameplayState);
        }

        await DBUserUtil.saveMultipleUsersGameplayState(gameplayStates);
    },
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean,
        saveGameplayState: boolean, cachedGameplayState?: UserGameplayState): Promise<boolean> =>
    {
        const user = socketUserContext.user;
        console.log(`ServerRoomManager.changeUserRoom :: roomID = ${roomID}, userID = ${user.id}`);
        await ServerUserManager.removeUserFromRoom(socketUserContext, prevRoomShouldExist, saveGameplayState);
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

        // Determine the user's position/direction/metadata for this room.
        // Priority: cachedGameplayState (from reconnection) > DB lookup > defaults
        let lastX = 16, lastY = 0.5 * PLAYER_HEIGHT, lastZ = 16;
        let lastDirX = 0, lastDirY = 0, lastDirZ = 1;
        let playerMetadata: {[key: string]: string} = {};
        let userRole: UserRole = UserRoleEnumMap.Visitor;

        if (cachedGameplayState && cachedGameplayState.lastRoomID === roomID)
        {
            lastX = cachedGameplayState.lastX;
            lastY = cachedGameplayState.lastY;
            lastZ = cachedGameplayState.lastZ;
            lastDirX = cachedGameplayState.lastDirX;
            lastDirY = cachedGameplayState.lastDirY;
            lastDirZ = cachedGameplayState.lastDirZ;
            playerMetadata = cachedGameplayState.playerMetadata;
            userRole = cachedGameplayState.userRole;
        }
        else
        {
            const roomState = await DBUserRoomStateUtil.findByUserAndRoom(user.id, roomID);
            if (roomState)
            {
                lastX = roomState.lastX;
                lastY = roomState.lastY;
                lastZ = roomState.lastZ;
                lastDirX = roomState.lastDirX;
                lastDirY = roomState.lastDirY;
                lastDirZ = roomState.lastDirZ;
                playerMetadata = (roomState.playerMetadata as {[key: string]: string}) ?? {};
                if (roomState.userRole != null)
                    userRole = roomState.userRole;
            }
        }

        // Owner takes priority regardless of what the DB/cache says.
        if (roomRuntimeMemory.room.ownerUserID === user.id)
            userRole = UserRoleEnumMap.Owner;

        ServerUserManager.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            new ObjectTransform({x: lastX, y: lastY, z: lastZ}, {x: lastDirX, y: lastDirY, z: lastDirZ}),
            playerMetadata, userRole
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
