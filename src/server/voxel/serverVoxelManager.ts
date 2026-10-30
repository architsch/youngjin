import Room from "../../shared/room/types/room";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../shared/system/sharedConstants";
import UserContext from "../sockets/types/userContext";
import ServerRoomManager from "../room/serverRoomManager";

// A user's edit is applied to their own client first, so one the server refuses, whatever refuses it (the edit's own
// checks, or the user's edit budget; see UserSignalDispatchUtil), is answered with what the room really holds where it
// touched (see sendBlockTruth), which puts the client back in step whatever it had made of it.
const ServerVoxelManager =
{
    onAddVoxelBlockSignalReceived: (socketUserContext: UserContext, signal: AddVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerVoxelManager::onAddVoxelBlockSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        if (!VoxelUpdateUtil.addVoxelBlock(user, room.voxelGrid.voxels, signal.quadIndex,
            signal.quadTextureIndicesWithinLayer, room))
        {
            console.error(`ServerVoxelManager::onAddVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            ServerVoxelManager.refuseAddVoxelBlockSignal(socketUserContext, signal);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("addVoxelBlockSignal", signal, socketUserContext);
    },
    refuseAddVoxelBlockSignal: (socketUserContext: UserContext, signal: AddVoxelBlockSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        if (room)
            sendBlockTruth(socketUserContext, room, signal.quadIndex);
    },
    onRemoveVoxelBlockSignalReceived: (socketUserContext: UserContext, signal: RemoveVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerVoxelManager::onRemoveVoxelBlockSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        if (!VoxelUpdateUtil.removeVoxelBlock(user, room.voxelGrid.voxels, signal.quadIndex, room))
        {
            console.error(`ServerVoxelManager::onRemoveVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            ServerVoxelManager.refuseRemoveVoxelBlockSignal(socketUserContext, signal);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("removeVoxelBlockSignal", signal, socketUserContext);
    },
    refuseRemoveVoxelBlockSignal: (socketUserContext: UserContext, signal: RemoveVoxelBlockSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        if (room)
            sendBlockTruth(socketUserContext, room, signal.quadIndex);
    },
    onMoveVoxelBlockSignalReceived: (socketUserContext: UserContext, signal: MoveVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerVoxelManager::onMoveVoxelBlockSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        if (!VoxelUpdateUtil.moveVoxelBlock(user, room.voxelGrid.voxels, signal.quadIndex, signal.rowOffset, signal.colOffset, signal.collisionLayerOffset, room))
        {
            console.error(`ServerVoxelManager::onMoveVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            ServerVoxelManager.refuseMoveVoxelBlockSignal(socketUserContext, signal);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("moveVoxelBlockSignal", signal, socketUserContext);
    },
    // Where the block was taken from, and where it was put (if that is anywhere in the room).
    refuseMoveVoxelBlockSignal: (socketUserContext: UserContext, signal: MoveVoxelBlockSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        if (!room)
            return;
        sendBlockTruth(socketUserContext, room, signal.quadIndex);
        const targetCollisionLayer =
            VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(signal.quadIndex) + signal.collisionLayerOffset;
        if (targetCollisionLayer >= COLLISION_LAYER_MIN && targetCollisionLayer <= COLLISION_LAYER_MAX)
        {
            sendBlockTruth(socketUserContext, room, VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
                VoxelQueryUtil.getVoxelRowFromQuadIndex(signal.quadIndex) + signal.rowOffset,
                VoxelQueryUtil.getVoxelColFromQuadIndex(signal.quadIndex) + signal.colOffset,
                targetCollisionLayer));
        }
    },
    onSetVoxelQuadTextureSignalReceived: (socketUserContext: UserContext, signal: SetVoxelQuadTextureSignal) =>
    {
        const user = socketUserContext.user;
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (!roomRuntimeMemory) // Single-player users have no server-side room; their edits are client-side only and must never mutate the shared room.
        {
            console.error(`ServerVoxelManager::onSetVoxelQuadTextureSignalReceived :: No room registered for user (userID = ${user.id})`);
            return;
        }
        const room = roomRuntimeMemory.room;

        if (!VoxelUpdateUtil.setVoxelQuadTexture(user, room.voxelGrid.voxels, signal.quadIndex, signal.textureIndex, room))
        {
            console.error(`ServerVoxelManager::onSetVoxelQuadTextureSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            ServerVoxelManager.refuseSetVoxelQuadTextureSignal(socketUserContext, signal);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignalFromUser("setVoxelQuadTextureSignal", signal, socketUserContext);
    },
    // The texture the face still has.
    refuseSetVoxelQuadTextureSignal: (socketUserContext: UserContext, signal: SetVoxelQuadTextureSignal) =>
    {
        const room = getRoomOf(socketUserContext);
        if (!room || !VoxelQueryUtil.isValidVoxelQuadIndex(signal.quadIndex))
            return;
        socketUserContext.addPendingSignalToUser("setVoxelQuadTextureSignal", new SetVoxelQuadTextureSignal(room.id,
            signal.quadIndex, room.voxelGrid.quadsMem.quads[signal.quadIndex] & 0b01111111));
    },
}

// The room the user is in on the server, which a single-player user has none of.
function getRoomOf(socketUserContext: UserContext): Room | undefined
{
    const roomID = ServerRoomManager.currentRoomIDByUserID[socketUserContext.user.id];
    return ServerRoomManager.roomRuntimeMemories[roomID]?.room;
}

// Tells a user what the cell layer of a quad really holds: its block, by an add (which gives whatever
// their client has there its textures), or that it holds none, by a remove. Nothing for a quad that is
// no block's.
function sendBlockTruth(socketUserContext: UserContext, room: Room, quadIndex: number): void
{
    if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        return;
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return;

    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    if (!VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, row, col, collisionLayer))
    {
        socketUserContext.addPendingSignalToUser("removeVoxelBlockSignal",
            new RemoveVoxelBlockSignal(room.id, firstQuadIndex));
        return;
    }

    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i] = room.voxelGrid.quadsMem.quads[firstQuadIndex + i] & 0b01111111;
    socketUserContext.addPendingSignalToUser("addVoxelBlockSignal",
        new AddVoxelBlockSignal(room.id, firstQuadIndex, textures));
}

export default ServerVoxelManager;
