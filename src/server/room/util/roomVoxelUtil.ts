import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../../shared/system/sharedConstants";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import UpdateVoxelGridTaskParams from "../../../shared/voxel/types/update/updateVoxelGridTaskParams";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../shared/voxel/util/voxelBlockUpdateUtil";
import { setVoxelQuadVisible } from "../../../shared/voxel/util/voxelQuadUpdateUtil";
import { getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
import { wouldBlockRemovalBreakPersistentObject } from "../../../shared/object/util/persistentObjectUpdateUtil";
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
            default:
                console.error(`Unknown task type :: ${task.type}`);
                break;
        }
    }
}

function moveVoxelBlockTask(socketUserContext: SocketUserContext, params: MoveVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`Voxel update failed (moveVoxelBlockTask) - room not found`);
        return;
    }
    const row = getVoxelRowFromQuadIndex(params.quadIndex);
    const col = getVoxelColFromQuadIndex(params.quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);
    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
    {
        console.warn(`Block move blocked: persistent object depends on this wall`);
        return;
    }
    if (!moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset))
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
    if (!room)
    {
        console.error(`Voxel update failed (removeVoxelBlockTask) - room not found`);
        return;
    }
    const row = getVoxelRowFromQuadIndex(params.quadIndex);
    const col = getVoxelColFromQuadIndex(params.quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);
    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
    {
        console.warn(`Block removal blocked: persistent object depends on this wall`);
        return;
    }
    if (!removeVoxelBlock(room, params.quadIndex))
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

function broadcast(socketUserContext: SocketUserContext, room: Room,
    signal: EncodableData, updateType: string)
{
    room.dirty = true; // Mark the room as dirty since its voxel grid has been modified.

    const user = socketUserContext.user;
    const socketRoomContext = RoomManager.socketRoomContexts[room.id];
    if (!socketRoomContext)
        console.error(`SocketRoomContext not found (roomID = ${room.id})`);
    else
    {
        Object.entries(socketRoomContext.getUserContexts()).forEach((kvp: [string, SocketUserContext]) => {
            if (user.id != kvp[0]) // Exclude the broadcast sender from the group of broadcast recipients (in order to prevent an infinite cycle).
            {
                const ctx = kvp[1];
                const success = ctx.tryUpdateLatestPendingSignalToUser("updateVoxelGridParams", (existingSignal: EncodableData) => {
                    const updateVoxelGridParams = existingSignal as UpdateVoxelGridParams;
                    updateVoxelGridParams.tasks.push(signal as UpdateVoxelGridTaskParams);
                });
                if (!success)
                {
                    ctx.addPendingSignalToUser("updateVoxelGridParams",
                        new UpdateVoxelGridParams(room.id, [signal as UpdateVoxelGridTaskParams]));
                }
            }
        });
    }
}

function getRoom(socketUserContext: SocketUserContext): Room | undefined
{
    const user = socketUserContext.user;
    const roomID = RoomManager.currentRoomIDByUserID[user.id];
    if (roomID == undefined)
    {
        console.error(`getRoom :: RoomID not found (userID = ${user.id})`);
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