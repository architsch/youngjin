import User from "../../../shared/auth/user";
import RoomVoxelActions from "../../../shared/room/roomVoxelActions";
import Room from "../../../shared/room/types/room";
import VoxelCubeAddParams from "../../../shared/voxel/types/voxelCubeAddParams";
import VoxelCubeChangeYParams from "../../../shared/voxel/types/voxelCubeChangeYParams";
import VoxelCubeRemoveParams from "../../../shared/voxel/types/voxelCubeRemoveParams";
import { VoxelCubeTextureIndexMap } from "../../../shared/voxel/types/voxelCubeTextureIndexMap";
import VoxelTextureChangeParams from "../../../shared/voxel/types/voxelTextureChangeParams";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";

export function changeVoxelCubeY(socketUserContext: SocketUserContext, row: number, col: number, yCenter: number, moveUp: boolean)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const room = getRoom(socketUserContext);
    if (!room || !RoomVoxelActions.changeCubeY(room, row, col, yCenter, moveUp ? 0.5 : -0.5))
    {
        console.error(`Voxel update failed (changeVoxelCubeY) - row: ${row}, col: ${col}, yCenter = ${yCenter}, moveUp = ${moveUp}`);
        // Send a recovery signal back to the client (to revert the erroneous client-side update)
        socketUserContext.addPendingSignal("voxelCubeChangeYParams", new VoxelCubeChangeYParams(row, col, yCenter, !moveUp));
        return;
    }

    const socketRoomContext = RoomManager.socketRoomContexts[room.roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.changeVoxelCubeY :: SocketRoomContext not found (roomID = ${room.roomID})`);
    else
        socketRoomContext.multicastSignal("voxelCubeChangeYParams", new VoxelCubeChangeYParams(row, col, yCenter, moveUp), user.userName);
}

export function addVoxelCube(socketUserContext: SocketUserContext, row: number, col: number, yCenter: number, textureIndex: number)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const textureIndexMap: VoxelCubeTextureIndexMap = {
        "x-": textureIndex,
        "x+": textureIndex,
        "y-": textureIndex,
        "y+": textureIndex,
        "z-": textureIndex,
        "z+": textureIndex,
    };
    
    const room = getRoom(socketUserContext);
    if (!room || !RoomVoxelActions.addCube(room, row, col, yCenter, textureIndexMap))
    {
        console.error(`Voxel update failed (addVoxelCube) - row: ${row}, col: ${col}, yCenter = ${yCenter}, textureIndex = ${textureIndex}`);
        // Send a recovery signal back to the client (to revert the erroneous client-side update)
        socketUserContext.addPendingSignal("voxelCubeRemoveParams", new VoxelCubeRemoveParams(row, col, yCenter));
        return;
    }

    const socketRoomContext = RoomManager.socketRoomContexts[room.roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.addVoxelCube :: SocketRoomContext not found (roomID = ${room.roomID})`);
    else
        socketRoomContext.multicastSignal("voxelCubeAddParams", new VoxelCubeAddParams(row, col, yCenter, textureIndex), user.userName);
}

export function removeVoxelCube(socketUserContext: SocketUserContext, row: number, col: number, yCenter: number)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const room = getRoom(socketUserContext);
    if (!room || !RoomVoxelActions.removeCube(room, row, col, yCenter))
    {
        console.error(`Voxel update failed (removeVoxelCube) - row: ${row}, col: ${col}, yCenter = ${yCenter}`);
        // Send a recovery signal back to the client (to revert the erroneous client-side update)
        socketUserContext.addPendingSignal("voxelCubeAddParams", new VoxelCubeAddParams(row, col, yCenter, 0));
        return;
    }

    const socketRoomContext = RoomManager.socketRoomContexts[room.roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.removeVoxelCube :: SocketRoomContext not found (roomID = ${room.roomID})`);
    else
        socketRoomContext.multicastSignal("voxelCubeRemoveParams", new VoxelCubeRemoveParams(row, col, yCenter), user.userName);
}

export function changeVoxelTexture(socketUserContext: SocketUserContext, row: number, col: number, quadIndex: number, textureIndex: number)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const room = getRoom(socketUserContext);
    if (!room || !RoomVoxelActions.changeVoxelTexture(room, row, col, quadIndex, textureIndex))
    {
        console.error(`Voxel update failed (changeVoxelTexture) - row: ${row}, col: ${col}, quadIndex = ${quadIndex}, textureIndex = ${textureIndex}`);
        return;
    }
    
    const socketRoomContext = RoomManager.socketRoomContexts[room.roomID];
    if (!socketRoomContext)
        console.error(`RoomManager.changeVoxelTexture :: SocketRoomContext not found (roomID = ${room.roomID})`);
    else
        socketRoomContext.multicastSignal("voxelTextureChangeParams", new VoxelTextureChangeParams(row, col, quadIndex, textureIndex), user.userName);
}

function getRoom(socketUserContext: SocketUserContext): Room | undefined
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserName[user.userName];
    if (roomID == undefined)
    {
        console.error(`RoomManager.getRoom :: RoomID not found (userName = ${user.userName})`);
        return undefined;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`RoomManager.getRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return undefined;
    }
    return roomRuntimeMemory.room;
}