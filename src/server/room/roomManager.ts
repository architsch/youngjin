import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../../shared/room/types/roomChangedSignal";
import ObjectTransform from "../../shared/object/types/objectTransform";
import SocketUserContext from "../sockets/types/socketUserContext";
import SocketRoomContext from "../sockets/types/socketRoomContext";
import RoomUserUtil from "./util/roomUserUtil";
import RoomCoreUtil from "./util/roomCoreUtil";
import DBRoomUtil from "../db/util/dbRoomUtil";
import { ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import UserGameplayState from "../user/types/userGameplayState";
import DBUserUtil from "../db/util/dbUserUtil";
import DBUserRoomStateUtil from "../db/util/dbUserRoomStateUtil";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";

const roomRuntimeMemories: {[roomID: string]: RoomRuntimeMemory} = {};
const socketRoomContexts: {[roomID: string]: SocketRoomContext} = {};
const currentRoomIDByUserID: {[userID: string]: string} = {};

const RoomManager =
{
    roomRuntimeMemories,
    socketRoomContexts,
    currentRoomIDByUserID,
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
                    console.log(`RoomManager.saveRooms :: Saved room (roomID = ${mem.room.id})`);
                }
                else
                    console.error(`RoomManager.saveRooms :: Failed to save room (roomID = ${mem.room.id})`);
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
                console.error(`RoomManager.saveAllUserGameplayStates :: RoomRuntimeMemory not found (roomID = ${roomID})`);
                continue;
            }
            const socketUserContext = socketUserContextsByUserID[userID];
            if (!socketUserContext)
            {
                console.error(`RoomManager.saveAllUserGameplayStates :: SocketUserContext not found (userID = ${userID})`);
                continue;
            }
            const gameplayState = RoomUserUtil.getUserGameplayState(socketUserContext, roomRuntimeMemory);
            if (gameplayState)
                gameplayStates.push(gameplayState);
        }

        await DBUserUtil.saveMultipleUsersGameplayState(gameplayStates);
    },
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean,
        saveGameplayState: boolean, cachedGameplayState?: UserGameplayState): Promise<boolean> =>
    {
        const user = socketUserContext.user;
        console.log(`RoomManager.changeUserRoom :: roomID = ${roomID}, userID = ${user.id}`);
        await RoomUserUtil.removeUserFromRoom(socketUserContext, prevRoomShouldExist, saveGameplayState);
        if (!roomID)
            return false;

        let roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            const mem = await RoomCoreUtil.loadRoom(roomID);
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
        let lastX = 16, lastY = 0, lastZ = 16;
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

        RoomUserUtil.addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            new ObjectTransform({x: lastX, y: lastY, z: lastZ}, {x: lastDirX, y: lastDirY, z: lastDirZ}),
            playerMetadata, userRole
        );

        // Wrap the room memory and user role in a RoomChangedSignal and unicast to the joining user.
        const roomChangedSignal = new RoomChangedSignal(roomRuntimeMemory, userRole);
        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.changeUserRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else // Send the room data to the user who is added to the room.
            socketRoomContext.unicastSignal("roomChangedSignal", roomChangedSignal, user.id);
        return true;
    },
}

// periodic room saving
let savingInProgress = false;
setInterval(async () => {
    if (savingInProgress)
        return;
    savingInProgress = true;
    await RoomManager.saveRooms();
    savingInProgress = false;
}, 3000);

export default RoomManager;
