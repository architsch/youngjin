import Room from "../../shared/room/types/room";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../shared/system/sharedConstants";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";

// A user's edit is applied to their own client first, so one the server refuses is answered with what the
// cell layers it touched really hold (see sendBlockTruth), which puts the client back in step whatever it
// had made of them.
const ServerVoxelManager =
{
    onAddVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: AddVoxelBlockSignal) =>
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
            sendBlockTruth(socketUserContext, room, signal.quadIndex);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("addVoxelBlockSignal", signal, user.id);
    },
    onRemoveVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: RemoveVoxelBlockSignal) =>
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
            sendBlockTruth(socketUserContext, room, signal.quadIndex);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("removeVoxelBlockSignal", signal, user.id);
    },
    onMoveVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: MoveVoxelBlockSignal) =>
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
            // Where the block was taken from, and where it was put (if that is anywhere in the room).
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
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("moveVoxelBlockSignal", signal, user.id);
    },
    onSetVoxelQuadTextureSignalReceived: (socketUserContext: SocketUserContext, signal: SetVoxelQuadTextureSignal) =>
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

        // Capture old texture for potential recovery.
        const oldTextureIndex = room.voxelGrid.quadsMem.quads[signal.quadIndex] & 0b01111111;

        if (!VoxelUpdateUtil.setVoxelQuadTexture(user, room.voxelGrid.voxels, signal.quadIndex, signal.textureIndex, room))
        {
            console.error(`ServerVoxelManager::onSetVoxelQuadTextureSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            socketUserContext.addPendingSignalToUser("setVoxelQuadTextureSignal",
                new SetVoxelQuadTextureSignal(room.id, signal.quadIndex, oldTextureIndex));
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("setVoxelQuadTextureSignal", signal, user.id);
    },
}

// Tells a user what the cell layer of a quad really holds: its block, by an add (which gives whatever
// their client has there its textures), or that it holds none, by a remove. Nothing for a quad that is
// no block's.
function sendBlockTruth(socketUserContext: SocketUserContext, room: Room, quadIndex: number): void
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
