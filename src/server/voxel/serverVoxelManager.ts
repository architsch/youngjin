import Room from "../../shared/room/types/room";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../shared/system/sharedConstants";
import SocketUserContext from "../sockets/types/socketUserContext";
import ServerRoomManager from "../room/serverRoomManager";
import ServerUserManager from "../user/serverUserManager";

const ServerVoxelManager =
{
    onAddVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: AddVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        if (!VoxelUpdateUtil.addVoxelBlock(userRole, room, signal.quadIndex, signal.quadTextureIndicesWithinLayer))
        {
            console.error(`ServerVoxelManager::onAddVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            socketUserContext.addPendingSignalToUser("removeVoxelBlockSignal",
                new RemoveVoxelBlockSignal(room.id, signal.quadIndex));
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("addVoxelBlockSignal", signal, user.id);
    },
    onRemoveVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: RemoveVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        // Capture textures before any modification attempt, for potential recovery.
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(signal.quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(signal.quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(signal.quadIndex);
        const textures = captureBlockTextures(room, row, col, collisionLayer);

        if (!VoxelUpdateUtil.removeVoxelBlock(userRole, room, signal.quadIndex))
        {
            console.error(`ServerVoxelManager::onRemoveVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            socketUserContext.addPendingSignalToUser("addVoxelBlockSignal",
                new AddVoxelBlockSignal(room.id, signal.quadIndex, textures));
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("removeVoxelBlockSignal", signal, user.id);
    },
    onMoveVoxelBlockSignalReceived: (socketUserContext: SocketUserContext, signal: MoveVoxelBlockSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(signal.quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(signal.quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(signal.quadIndex);

        // Capture source block textures before any modification attempt, for potential recovery.
        const sourceTextures = captureBlockTextures(room, row, col, collisionLayer);

        if (!VoxelUpdateUtil.moveVoxelBlock(userRole, room, signal.quadIndex, signal.rowOffset, signal.colOffset, signal.collisionLayerOffset))
        {
            console.error(`ServerVoxelManager::onMoveVoxelBlockSignalReceived :: Failed (quadIndex=${signal.quadIndex})`);
            sendMoveReversal(socketUserContext, room, signal, sourceTextures);
            return;
        }

        const socketRoomContext = ServerRoomManager.socketRoomContexts[roomID];
        socketRoomContext.multicastSignal("moveVoxelBlockSignal", signal, user.id);
    },
    onSetVoxelQuadTextureSignalReceived: (socketUserContext: SocketUserContext, signal: SetVoxelQuadTextureSignal) =>
    {
        const user = socketUserContext.user;
        const userRole = ServerUserManager.getUserRole(user.id);
        const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
        const roomRuntimeMemory = ServerRoomManager.roomRuntimeMemories[roomID];
        const room = roomRuntimeMemory.room;

        // Capture old texture for potential recovery.
        const oldTextureIndex = room.voxelGrid.quadsMem.quads[signal.quadIndex] & 0b01111111;

        if (!VoxelUpdateUtil.setVoxelQuadTexture(userRole, room, signal.quadIndex, signal.textureIndex))
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

function captureBlockTextures(room: Room,
    row: number, col: number, collisionLayer: number): number[]
{
    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i] = room.voxelGrid.quadsMem.quads[startIndex + i] & 0b01111111;
    return textures;
}

function sendMoveReversal(socketUserContext: SocketUserContext,
    room: Room,
    signal: MoveVoxelBlockSignal, sourceTextures: number[])
{
    // The client applied the move optimistically: added block at target, removed block at source.
    // To reverse: remove the block at the target and re-add the block at the source.
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(signal.quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(signal.quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(signal.quadIndex);

    let newCollisionLayer = collisionLayer + signal.collisionLayerOffset;
    if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
        newCollisionLayer = COLLISION_LAYER_NULL;

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(row + signal.rowOffset, col + signal.colOffset,
        "y", "-", newCollisionLayer);

    socketUserContext.addPendingSignalToUser("removeVoxelBlockSignal",
        new RemoveVoxelBlockSignal(room.id, targetQuadIndex));
    socketUserContext.addPendingSignalToUser("addVoxelBlockSignal",
        new AddVoxelBlockSignal(room.id, signal.quadIndex, sourceTextures));
}

export default ServerVoxelManager;
