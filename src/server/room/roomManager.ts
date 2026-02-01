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
import { addUserToRoom, removeUserFromRoom } from "./util/roomUserUtil";
import { loadRoom } from "./util/roomCoreUtil";
import { updateVoxelGrid } from "./util/roomVoxelUtil";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import DBRoomUtil from "../db/util/dbRoomUtil";
import { ROOM_SAVE_INTERVAL } from "../../shared/system/sharedConstants";

const roomRuntimeMemories: {[roomID: string]: RoomRuntimeMemory} = {};
const socketRoomContexts: {[roomID: string]: SocketRoomContext} = {};
const currentRoomIDByUserName: {[userName: string]: string} = {};

const RoomManager =
{
    roomRuntimeMemories,
    socketRoomContexts,
    currentRoomIDByUserName,
    saveRooms: async () =>
    {
        const currTimeInMillis = Date.now();
        //console.log(`RoomManager.saveRooms :: Saving rooms... (currTimeInMillis = ${Math.floor(currTimeInMillis)})`);
        for (const [roomID, roomRuntimeMemory] of Object.entries(roomRuntimeMemories))
        {
            if (roomRuntimeMemory.room.dirty &&
                currTimeInMillis >= roomRuntimeMemory.lastSavedTimeInMillis + ROOM_SAVE_INTERVAL)
            {
                const success = await DBRoomUtil.saveRoomContent(roomRuntimeMemory.room);
                if (success)
                {
                    roomRuntimeMemory.lastSavedTimeInMillis = Date.now();
                    roomRuntimeMemory.room.dirty = false;
                    console.log(`RoomManager.saveRooms :: Saved room (roomID = ${roomID})`);
                }
                else
                    console.error(`RoomManager.saveRooms :: Failed to save room (roomID = ${roomID})`);
            }
        }
    },
    changeUserRoom: async (socketUserContext: SocketUserContext, roomID: string | undefined, prevRoomShouldExist: boolean) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        console.log(`RoomManager.changeUserRoom :: roomID = ${roomID}, userName = ${user.userName}`);
        await removeUserFromRoom(socketUserContext, prevRoomShouldExist);
        if (!roomID)
            return;
    
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
            return;
        }
        addUserToRoom(socketUserContext, roomRuntimeMemory, user.userName);

        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.changeUserRoom :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.unicastSignal("roomRuntimeMemory", roomRuntimeMemory, user.userName);
    },
    updateVoxelGrid: (socketUserContext: SocketUserContext, params: UpdateVoxelGridParams) =>
    {
        updateVoxelGrid(socketUserContext, params);
    },
    sendObjectMessage: (socketUserContext: SocketUserContext, params: ObjectMessageParams) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        if (roomID == undefined)
        {
            console.error(`RoomManager.sendObjectMessage :: RoomID not found (userName = ${user.userName})`);
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
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName != user.userName)
        {
            console.error(`RoomManager.sendObjectMessage :: User has no authority to control this object (roomID = ${roomID}, objectId = ${params.senderObjectId})`);
            return;
        }
        params.message = params.message.trim().substring(0, 32);

        const socketRoomContext = socketRoomContexts[roomID];
        if (!socketRoomContext)
            console.error(`RoomManager.sendObjectMessage :: SocketRoomContext not found (roomID = ${roomID})`);
        else
            socketRoomContext.multicastSignal("objectMessageParams", params, user.userName);
    },
    updateObjectTransform: (socketUserContext: SocketUserContext, objectId: string, transform: ObjectTransform) =>
    {
        const user: User = socketUserContext.socket.handshake.auth as User;
        const roomID = currentRoomIDByUserName[user.userName];
        if (roomID == undefined)
        {
            console.error(`RoomManager.updateObjectTransform :: RoomID not found (userName = ${user.userName})`);
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
        if (objectRuntimeMemory.objectSpawnParams.sourceUserName != user.userName)
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
                socketRoomContext.multicastSignal("objectSyncParams", params, user.userName);
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