import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../../shared/system/sharedConstants";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import UpdateVoxelGridTaskParams from "../../../shared/voxel/types/update/updateVoxelGridTaskParams";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../shared/voxel/util/voxelBlockUpdateUtil";
import { setVoxelQuadVisible } from "../../../shared/voxel/util/voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../shared/voxel/util/voxelQueryUtil";
import { wouldBlockRemovalBreakPersistentObject } from "../../../shared/object/util/persistentObjectUpdateUtil";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import { getRoom } from "./roomCoreUtil";

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

    // Capture source block textures before any modification attempt, for potential recovery.
    const sourceTextures = captureBlockTextures(room, row, col, collisionLayer);

    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
    {
        console.warn(`Block move blocked: persistent object depends on this wall`);
        sendMoveReversal(socketUserContext, room, params, sourceTextures);
        return;
    }
    if (!moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset))
    {
        console.error(`Voxel update failed (moveVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        sendMoveReversal(socketUserContext, room, params, sourceTextures);
        return;
    }
    broadcast(socketUserContext, room, params);
}

function addVoxelBlockTask(socketUserContext: SocketUserContext, params: AddVoxelBlockParams)
{
    const room = getRoom(socketUserContext);
    if (!room)
    {
        console.error(`Voxel update failed (addVoxelBlockTask) - room not found`);
        return;
    }
    if (!addVoxelBlock(room, params.quadIndex, params.quadTextureIndicesWithinLayer))
    {
        console.error(`Voxel update failed (addVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        unicastToSender(socketUserContext, room, [new RemoveVoxelBlockParams(params.quadIndex)]);
        return;
    }
    broadcast(socketUserContext, room, params);
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

    // Capture textures before any modification attempt, for potential recovery.
    const textures = captureBlockTextures(room, row, col, collisionLayer);

    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
    {
        console.warn(`Block removal blocked: persistent object depends on this wall`);
        unicastToSender(socketUserContext, room, [new AddVoxelBlockParams(params.quadIndex, textures)]);
        return;
    }
    if (!removeVoxelBlock(room, params.quadIndex))
    {
        console.error(`Voxel update failed (removeVoxelBlockTask) - params: ${JSON.stringify(params)}`);
        unicastToSender(socketUserContext, room, [new AddVoxelBlockParams(params.quadIndex, textures)]);
        return;
    }
    broadcast(socketUserContext, room, params);
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

    // Capture old texture for potential recovery.
    const oldTextureIndex = voxel.quadsMem.quads[quadIndex] & 0b01111111;

    if (!setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, params.textureIndex))
    {
        console.error(`Voxel update failed (setVoxelQuadTextureTask) - params: ${JSON.stringify(params)}`);
        unicastToSender(socketUserContext, room, [new SetVoxelQuadTextureParams(quadIndex, oldTextureIndex)]);
        return;
    }
    broadcast(socketUserContext, room, params);
}

function captureBlockTextures(room: Room, row: number, col: number, collisionLayer: number): number[]
{
    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i] = room.voxelGrid.quadsMem.quads[startIndex + i] & 0b01111111;
    return textures;
}

function sendMoveReversal(socketUserContext: SocketUserContext, room: Room,
    params: MoveVoxelBlockParams, sourceTextures: number[])
{
    // The client applied the move optimistically: added block at target, removed block at source.
    // To reverse: remove the block at the target and re-add the block at the source.
    const row = getVoxelRowFromQuadIndex(params.quadIndex);
    const col = getVoxelColFromQuadIndex(params.quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);

    let newCollisionLayer = collisionLayer + params.collisionLayerOffset;
    if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
        newCollisionLayer = COLLISION_LAYER_NULL;

    const targetQuadIndex = getVoxelQuadIndex(row + params.rowOffset, col + params.colOffset,
        "y", "-", newCollisionLayer);

    unicastToSender(socketUserContext, room, [
        new RemoveVoxelBlockParams(targetQuadIndex),
        new AddVoxelBlockParams(params.quadIndex, sourceTextures),
    ]);
}

function unicastToSender(socketUserContext: SocketUserContext, room: Room,
    tasks: UpdateVoxelGridTaskParams[])
{
    const success = socketUserContext.tryUpdateLatestPendingSignalToUser("updateVoxelGridParams", (existingSignal: EncodableData) => {
        const updateVoxelGridParams = existingSignal as UpdateVoxelGridParams;
        for (const task of tasks)
            updateVoxelGridParams.tasks.push(task);
    });
    if (!success)
    {
        socketUserContext.addPendingSignalToUser("updateVoxelGridParams",
            new UpdateVoxelGridParams(room.id, tasks));
    }
}

function broadcast(socketUserContext: SocketUserContext, room: Room,
    signal: EncodableData)
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