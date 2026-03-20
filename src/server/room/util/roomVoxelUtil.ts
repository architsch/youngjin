import EncodableData from "../../../shared/networking/types/encodableData";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../shared/system/sharedConstants";
import { UserRoleEnumMap } from "../../../shared/user/types/userRole";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelBlockUpdateUtil from "../../../shared/voxel/util/voxelBlockUpdateUtil";
import VoxelQuadUpdateUtil from "../../../shared/voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import SocketUserContext from "../../sockets/types/socketUserContext";
import RoomManager from "../roomManager";
import RoomCoreUtil from "./roomCoreUtil";
import RoomUserUtil from "./roomUserUtil";

function canUserModifyVoxel(userID: string): boolean
{
    const role = RoomUserUtil.getUserRole(userID);
    if (role === UserRoleEnumMap.Owner || role === UserRoleEnumMap.Editor)
        return true;
    const roomID = RoomManager.currentRoomIDByUserID[userID];
    if (roomID)
    {
        const roomRuntimeMemory = RoomManager.roomRuntimeMemories[roomID];
        if (roomRuntimeMemory && roomRuntimeMemory.room.roomType === RoomTypeEnumMap.Hub)
            return true;
    }
    return false;
}

function captureBlockTextures(room: Room, row: number, col: number, collisionLayer: number): number[]
{
    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i] = room.voxelGrid.quadsMem.quads[startIndex + i] & 0b01111111;
    return textures;
}

function sendMoveReversal(socketUserContext: SocketUserContext, room: Room,
    params: MoveVoxelBlockSignal, sourceTextures: number[])
{
    // The client applied the move optimistically: added block at target, removed block at source.
    // To reverse: remove the block at the target and re-add the block at the source.
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(params.quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(params.quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);

    let newCollisionLayer = collisionLayer + params.collisionLayerOffset;
    if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
        newCollisionLayer = COLLISION_LAYER_NULL;

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(row + params.rowOffset, col + params.colOffset,
        "y", "-", newCollisionLayer);

    unicastToSender(socketUserContext, "removeVoxelBlockSignal",
        new RemoveVoxelBlockSignal(room.id, targetQuadIndex));
    unicastToSender(socketUserContext, "addVoxelBlockSignal",
        new AddVoxelBlockSignal(room.id, params.quadIndex, sourceTextures));
}

function unicastToSender(socketUserContext: SocketUserContext,
    signalType: string, signal: EncodableData)
{
    socketUserContext.addPendingSignalToUser(signalType, signal);
}

function broadcast(socketUserContext: SocketUserContext, room: Room,
    signalType: string, signal: EncodableData)
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
                ctx.addPendingSignalToUser(signalType, signal);
            }
        });
    }
}

const RoomVoxelUtil =
{
    moveVoxelBlock: (socketUserContext: SocketUserContext, params: MoveVoxelBlockSignal) =>
    {
        if (!canUserModifyVoxel(socketUserContext.user.id))
        {
            console.warn(`(RoomVoxelUtil) Rejected moveVoxelBlockParams from Visitor (userID = ${socketUserContext.user.id})`);
            return;
        }
        const room = RoomCoreUtil.getRoom(socketUserContext);
        if (!room)
        {
            console.error(`Voxel update failed (moveVoxelBlock) - room not found`);
            return;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(params.quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(params.quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);

        // Capture source block textures before any modification attempt, for potential recovery.
        const sourceTextures = captureBlockTextures(room, row, col, collisionLayer);
        if (!VoxelBlockUpdateUtil.moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset))
        {
            console.error(`Voxel update failed (moveVoxelBlock) - params: ${JSON.stringify(params)}`);
            sendMoveReversal(socketUserContext, room, params, sourceTextures);
            return;
        }
        broadcast(socketUserContext, room, "moveVoxelBlockSignal", params);
    },
    addVoxelBlock: (socketUserContext: SocketUserContext, params: AddVoxelBlockSignal) =>
    {
        if (!canUserModifyVoxel(socketUserContext.user.id))
        {
            console.warn(`(RoomVoxelUtil) Rejected addVoxelBlockParams from Visitor (userID = ${socketUserContext.user.id})`);
            return;
        }
        const room = RoomCoreUtil.getRoom(socketUserContext);
        if (!room)
        {
            console.error(`Voxel update failed (addVoxelBlock) - room not found`);
            return;
        }
        if (!VoxelBlockUpdateUtil.addVoxelBlock(room, params.quadIndex, params.quadTextureIndicesWithinLayer))
        {
            console.error(`Voxel update failed (addVoxelBlock) - params: ${JSON.stringify(params)}`);
            unicastToSender(socketUserContext, "removeVoxelBlockSignal",
                new RemoveVoxelBlockSignal(room.id, params.quadIndex));
            return;
        }
        broadcast(socketUserContext, room, "addVoxelBlockSignal", params);
    },
    removeVoxelBlock: (socketUserContext: SocketUserContext, params: RemoveVoxelBlockSignal) =>
    {
        if (!canUserModifyVoxel(socketUserContext.user.id))
        {
            console.warn(`(RoomVoxelUtil) Rejected removeVoxelBlockParams from Visitor (userID = ${socketUserContext.user.id})`);
            return;
        }
        const room = RoomCoreUtil.getRoom(socketUserContext);
        if (!room)
        {
            console.error(`Voxel update failed (removeVoxelBlock) - room not found`);
            return;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(params.quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(params.quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(params.quadIndex);

        // Capture textures before any modification attempt, for potential recovery.
        const textures = captureBlockTextures(room, row, col, collisionLayer);
        if (!VoxelBlockUpdateUtil.removeVoxelBlock(room, params.quadIndex))
        {
            console.error(`Voxel update failed (removeVoxelBlock) - params: ${JSON.stringify(params)}`);
            unicastToSender(socketUserContext, "addVoxelBlockSignal",
                new AddVoxelBlockSignal(room.id, params.quadIndex, textures));
            return;
        }
        broadcast(socketUserContext, room, "removeVoxelBlockSignal", params);
    },
    setVoxelQuadTexture: (socketUserContext: SocketUserContext, params: SetVoxelQuadTextureSignal) =>
    {
        if (!canUserModifyVoxel(socketUserContext.user.id))
        {
            console.warn(`(RoomVoxelUtil) Rejected setVoxelQuadTextureParams from Visitor (userID = ${socketUserContext.user.id})`);
            return;
        }
        const room = RoomCoreUtil.getRoom(socketUserContext);
        if (!room)
        {
            console.error(`Voxel update failed (setVoxelQuadTexture) - room not found - params: ${JSON.stringify(params)}`);
            return;
        }
        const quadIndex = params.quadIndex;
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`Voxel update failed (setVoxelQuadTexture) - voxel not found - params: ${JSON.stringify(params)}`);
            return;
        }
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        // Capture old texture for potential recovery.
        const oldTextureIndex = voxel.quadsMem.quads[quadIndex] & 0b01111111;

        if (!VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, params.textureIndex))
        {
            console.error(`Voxel update failed (setVoxelQuadTexture) - params: ${JSON.stringify(params)}`);
            unicastToSender(socketUserContext, "setVoxelQuadTextureSignal",
                new SetVoxelQuadTextureSignal(room.id, quadIndex, oldTextureIndex));
            return;
        }
        broadcast(socketUserContext, room, "setVoxelQuadTextureSignal", params);
    },
}

export default RoomVoxelUtil;
