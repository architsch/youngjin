import User from "../../../shared/auth/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../shared/voxel/util/voxelBlockUpdateUtil";
import { showVoxelQuad } from "../../../shared/voxel/util/voxelQuadUpdateUtil";
import { getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";

export function updateVoxelGrid(socketUserContext: SocketUserContext, params: UpdateVoxelGridParams)
{
    for (const taskParams of params.moveVoxelBlockTasks)
        moveVoxelBlockTask(socketUserContext, taskParams);
    for (const taskParams of params.addVoxelBlockTasks)
        addVoxelBlockTask(socketUserContext, taskParams);
    for (const taskParams of params.removeVoxelBlockTasks)
        removeVoxelBlockTask(socketUserContext, taskParams);
    for (const taskParams of params.setVoxelQuadTextureTasks)
        setVoxelQuadTextureTask(socketUserContext, taskParams);
}

function moveVoxelBlockTask(socketUserContext: SocketUserContext, params: MoveVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room || !moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset))
    {
        console.error(`Voxel update failed (moveVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "moveVoxelBlock");
}

function addVoxelBlockTask(socketUserContext: SocketUserContext, params: AddVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room || !addVoxelBlock(room, params.quadIndex, params.quadTextureIndicesWithinLayer))
    {
        console.error(`Voxel update failed (addVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "addVoxelBlock");
}

function removeVoxelBlockTask(socketUserContext: SocketUserContext, params: RemoveVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room || !removeVoxelBlock(room, params.quadIndex))
    {
        console.error(`Voxel update failed (removeVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "removeVoxelBlock");
}

function setVoxelQuadTextureTask(socketUserContext: SocketUserContext, params: SetVoxelQuadTextureParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`Voxel update failed (setVoxelQuadTextureTask) - room not found - params: ${JSON.stringify(params)}`);
        return;
    }
    const quadIndex = params.quadIndex;
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`Voxel update failed (setVoxelQuadTextureTask) - voxel not found - params: ${JSON.stringify(params)}`);
        return;
    }
    const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (!showVoxelQuad(voxel, facingAxis, orientation, collisionLayer, params.textureIndex))
    {
        console.error(`Voxel update failed (setVoxelQuadTextureTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "setVoxelQuadTexture");
}

function broadcast(socketUserContext: SocketUserContext, room: Room,
    signal: EncodableData, updateType: string)
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const socketRoomContext = RoomManager.socketRoomContexts[room.roomID];
    if (!socketRoomContext)
        console.error(`SocketRoomContext not found (roomID = ${room.roomID})`);
    else
    {
        Object.entries(socketRoomContext.getUserContexts()).forEach((kvp: [string, SocketUserContext]) => {
            if (user.userName != kvp[0])
            {
                const ctx = kvp[1];
                const success = ctx.tryUpdateLatestPendingSignal("updateVoxelGrid", (existingSignal: EncodableData) => {
                    const updateVoxelGridParams = existingSignal as UpdateVoxelGridParams;
                    switch (updateType)
                    {
                        case "moveVoxelBlock": updateVoxelGridParams.moveVoxelBlockTasks.push(signal as MoveVoxelBlockParams); break;
                        case "addVoxelBlock": updateVoxelGridParams.addVoxelBlockTasks.push(signal as AddVoxelBlockParams); break;
                        case "removeVoxelBlock": updateVoxelGridParams.removeVoxelBlockTasks.push(signal as RemoveVoxelBlockParams); break;
                        case "setVoxelQuadTexture": updateVoxelGridParams.setVoxelQuadTextureTasks.push(signal as SetVoxelQuadTextureParams); break;
                        default: throw new Error(`Unknown updateType :: ${updateType}`);
                    }
                });
                if (!success)
                {
                    ctx.addPendingSignal("updateVoxelGrid", new UpdateVoxelGridParams(
                        updateType == "moveVoxelBlock" ? [signal as MoveVoxelBlockParams] : [],
                        updateType == "addVoxelBlock" ? [signal as AddVoxelBlockParams] : [],
                        updateType == "removeVoxelBlock" ? [signal as RemoveVoxelBlockParams] : [],
                        updateType == "setVoxelQuadTexture" ? [signal as SetVoxelQuadTextureParams] : []
                    ));
                }
            }
        });
    }
}

function getRoom(socketUserContext: SocketUserContext): Room | undefined
{
    const user: User = socketUserContext.socket.handshake.auth as User;
    const roomID = RoomManager.currentRoomIDByUserName[user.userName];
    if (roomID == undefined)
    {
        console.error(`getRoom :: RoomID not found (userName = ${user.userName})`);
        return undefined;
    }
    const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
    if (roomRuntimeMemory == undefined)
    {
        console.error(`getRoom :: RoomRuntimeMemory doesn't exist (roomID = ${roomID})`);
        return undefined;
    }
    return roomRuntimeMemory.room;
}