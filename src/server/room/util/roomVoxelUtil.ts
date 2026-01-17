import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../../shared/system/constants";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import UpdateVoxelGridTaskParams from "../../../shared/voxel/types/update/updateVoxelGridTaskParams";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../shared/voxel/util/voxelBlockUpdateUtil";
import { setVoxelQuadVisible } from "../../../shared/voxel/util/voxelQuadUpdateUtil";
import { getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";

export function updateVoxelGrid(socketUserContext: SocketUserContext, params: UpdateVoxelGridParams)
{
    for (const task of params.tasks)
    {
        switch (task.type)
        {
            case VOXEL_GRID_TASK_TYPE_MOVE:
                moveVoxelBlockTask(socketUserContext, task as MoveVoxelBlockParams);
                break;
            case VOXEL_GRID_TASK_TYPE_ADD:
                addVoxelBlockTask(socketUserContext, task as AddVoxelBlockParams);
                break;
            case VOXEL_GRID_TASK_TYPE_REMOVE:
                removeVoxelBlockTask(socketUserContext, task as RemoveVoxelBlockParams);
                break;
            case VOXEL_GRID_TASK_TYPE_TEX:
                setVoxelQuadTextureTask(socketUserContext, task as SetVoxelQuadTextureParams);
                break;
            /*case VOXEL_GRID_TASK_TYPE_SHRINK_OR_EXPAND:
                shrinkOrExpandVoxelBlockTask(socketUserContext, task as ShrinkOrExpandVoxelBlockParams);
                break;*/
            default:
                console.error(`Unknown task type :: ${task.type}`);
                break;
        }
    }
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
    if (!room || !addVoxelBlock(room, params.quadIndex, /*params.xShrink, params.zShrink,*/ params.quadTextureIndicesWithinLayer))
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
    if (!setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, params.textureIndex))
    {
        console.error(`Voxel update failed (setVoxelQuadTextureTask) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "setVoxelQuadTexture");
}

/*function shrinkOrExpandVoxelBlockTask(socketUserContext: SocketUserContext, params: ShrinkOrExpandVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room || !shrinkOrExpandVoxelBlock(room, params.quadIndex))
    {
        console.error(`Voxel update failed (shrinkOrExpandVoxelBlock) - params: ${JSON.stringify(params)}`);
        return;
    }
    broadcast(socketUserContext, room, params, "shrinkOrExpandVoxelBlock");
}*/

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
            if (user.userName != kvp[0]) // Exclude the broadcast sender from the group of broadcast recipients (in order to prevent an infinite cycle).
            {
                const ctx = kvp[1];
                const success = ctx.tryUpdateLatestPendingSignal("updateVoxelGridParams", (existingSignal: EncodableData) => {
                    const updateVoxelGridParams = existingSignal as UpdateVoxelGridParams;
                    updateVoxelGridParams.tasks.push(signal as UpdateVoxelGridTaskParams);
                });
                if (!success)
                {
                    ctx.addPendingSignal("updateVoxelGridParams",
                        new UpdateVoxelGridParams([signal as UpdateVoxelGridTaskParams]));
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