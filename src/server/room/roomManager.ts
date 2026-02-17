import User from "../../shared/user/types/user";
import PhysicsManager from "../../shared/physics/physicsManager";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Vec2 from "../../shared/math/types/vec2";
import ObjectTransform from "../../shared/object/types/objectTransform";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import SocketUserContext from "../sockets/types/socketUserContext";
import SocketRoomContext from "../sockets/types/socketRoomContext";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import { addUserToRoom, getUserGameplayState, removeUserFromRoom } from "./util/roomUserUtil";
import { loadRoom } from "./util/roomCoreUtil";
import { updateVoxelGrid } from "./util/roomVoxelUtil";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import DBRoomUtil from "../db/util/dbRoomUtil";
import { ROOM_AUTO_SAVE_INTERVAL } from "../../shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../shared/object/types/objectMetadataKey";
import UserGameplayState from "../user/types/userGameplayState";
import DBUserUtil from "../db/util/dbUserUtil";

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

        const BATCH_SIZE = 5; // Saving too many rooms at once will introduce too much bandwidth, but saving too few rooms will slow down the whole process. We should pick a number that is neither too high nor too low.
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
            const gameplayState = getUserGameplayState(socketUserContext, roomRuntimeMemory);
            if (gameplayState)
                gameplayStates.push(gameplayState);
        }

        await DBUserUtil.saveMultipleUsersGameplayState(gameplayStates);
    },
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean,
        saveGameplayState: boolean = true): Promise<boolean> =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        console.log(`RoomManager.changeUserRoom :: roomID = ${roomID}, userID = ${user.id}`);
        await removeUserFromRoom(socketUserContext, prevRoomShouldExist, saveGameplayState);
        if (!roomID)
            return false;
    
        let roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory)
        {
            const mem = await loadRoom(roomID);
            if (mem)
                roomRuntimeMemory = mem;
        }
        if (!roomRuntimeMemory)
        {
            console.error(`Failed to load room (ID = ${roomID})`);
            return false;
        }
        addUserToRoom(socketUserContext, roomRuntimeMemory, user.id,
            new ObjectTransform(
                user.lastX, user.lastY, user.lastZ,
                user.lastDirX, user.lastDirY, user.lastDirZ)
        );

        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.changeUserRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.unicastSignal("roomRuntimeMemory", roomRuntimeMemory, user.id);
        return true;
    },
    updateVoxelGrid: (socketUserContext: SocketUserContext, params: UpdateVoxelGridParams) =>
    {
        updateVoxelGrid(socketUserContext, params);
    },
    sendObjectMessage: (socketUserContext: SocketUserContext, params: ObjectMessageParams) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserID[user.id];
        if (roomID == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[params.senderObjectId];
        if (objectRuntimeMemory == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${params.senderObjectId})`);
            return;
        }
        if (objectRuntimeMemory.objectSpawnParams.sourceUserID != user.id)
        {
            console.error(`RoomManager.sendObjectMessage :: User has no authority to control this object (roomID = ${roomID}, objectId = ${params.senderObjectId})`);
            return;
        }
        params.message = params.message.trim().substring(0, 32);
        objectRuntimeMemory.objectSpawnParams.setMetadata(ObjectMetadataKeyEnumMap.SentMessage, params.message);

        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.sendObjectMessage :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("objectMessageParams", params, user.id);
    },
    updateObjectTransform: (socketUserContext: SocketUserContext, objectId: string, transform: ObjectTransform) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserID[user.id];
        if (roomID == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomID not found (userID = ${user.id})`);
            return;
        }
        const roomRuntimeMemory = roomRuntimeMemories[roomID];
        if (roomRuntimeMemory == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
            return;
        }
        const objectRuntimeMemory = roomRuntimeMemory.objectRuntimeMemories[objectId];
        if (objectRuntimeMemory == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: ObjectRuntimeMemory doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        if (objectRuntimeMemory.objectSpawnParams.sourceUserID != user.id)
        {
            console.error(`RoomManager.updateObjectTransform :: User has no authority to control this object (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }

        const targetPos: Vec2 = { x: transform.x, y: transform.z };
        const result = PhysicsManager.tryMoveObject(roomID, objectId, targetPos);
        transform.x = result.resolvedPos.x;
        transform.z = result.resolvedPos.y;
        Object.assign(objectRuntimeMemory.objectSpawnParams.transform, transform);

        if (result.desyncDetected)
        {
            const params = new ObjectDesyncResolveParams(objectId, result.resolvedPos);
            const socketRoomContext = socketRoomContexts[roomID];
            if (!socketRoomContext)
                console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
            else
                socketRoomContext.multicastSignal("objectDesyncResolveParams", params);
        }
        else
        {
            const params = new ObjectSyncParams(objectId, transform);
            const socketRoomContext = socketRoomContexts[roomID];
            if (!socketRoomContext)
                console.error(`RoomManager.updateObjectTransform :: SocketRoomContext not found (roomID = ${roomID})`);
            else
                socketRoomContext.multicastSignal("objectSyncParams", params, user.id);
        }
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