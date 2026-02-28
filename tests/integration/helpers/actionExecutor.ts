/**
 * Shared action types, arbitraries, and executor for property-based
 * integration tests (fast-check).
 *
 * Extracted so that both `randomized-sequences.test.ts` and any future
 * property-based test can reuse the same building blocks.
 */
import fc from "fast-check";
import { harness, ConnectedUser } from "./serverHarness";
import RoomManager from "../../../src/server/room/roomManager";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectMessageParams from "../../../src/shared/object/types/objectMessageParams";
import { getVoxel, getFirstVoxelQuadIndexInLayer } from "../../../src/shared/voxel/util/voxelQueryUtil";
import { addVoxelBlock, removeVoxelBlock } from "../../../src/shared/voxel/util/voxelBlockUpdateUtil";

// ─── Configuration ──────────────────────────────────────────────────────────

export const MAX_USERS = 10;
export const ROOM_IDS = ["room-A", "room-B", "room-C"];
export const NUM_RUNS = 30;
export const MAX_ACTIONS = 50;

// ─── Action Types ───────────────────────────────────────────────────────────

export type Action =
    | { type: "connect" }
    | { type: "disconnect"; userIndex: number }
    | { type: "joinRoom"; userIndex: number; roomID: string }
    | { type: "moveObject"; userIndex: number; dx: number; dz: number }
    | { type: "sendMessage"; userIndex: number; message: string }
    | { type: "editVoxel"; userIndex: number; row: number; col: number; add: boolean };

// ─── Action Arbitraries ─────────────────────────────────────────────────────

export const connectAction = fc.constant<Action>({ type: "connect" });

export const disconnectAction = fc.nat({ max: MAX_USERS - 1 }).map<Action>(i => ({
    type: "disconnect",
    userIndex: i,
}));

export const joinRoomAction = fc.record<Action & { type: "joinRoom" }>({
    type: fc.constant("joinRoom" as const),
    userIndex: fc.nat({ max: MAX_USERS - 1 }),
    roomID: fc.constantFrom(...ROOM_IDS),
});

export const moveObjectAction = fc.record<Action & { type: "moveObject" }>({
    type: fc.constant("moveObject" as const),
    userIndex: fc.nat({ max: MAX_USERS - 1 }),
    dx: fc.double({ min: -2, max: 2, noNaN: true }),
    dz: fc.double({ min: -2, max: 2, noNaN: true }),
});

export const sendMessageAction = fc.record<Action & { type: "sendMessage" }>({
    type: fc.constant("sendMessage" as const),
    userIndex: fc.nat({ max: MAX_USERS - 1 }),
    message: fc.string({ minLength: 1, maxLength: 32 }),
});

export const editVoxelAction = fc.record<Action & { type: "editVoxel" }>({
    type: fc.constant("editVoxel" as const),
    userIndex: fc.nat({ max: MAX_USERS - 1 }),
    row: fc.nat({ min: 2, max: 29 }),
    col: fc.nat({ min: 2, max: 29 }),
    add: fc.boolean(),
});

/** Default mixed-action arbitrary with balanced weights. */
export const actionArb = fc.oneof(
    { weight: 2, arbitrary: connectAction },
    { weight: 2, arbitrary: disconnectAction },
    { weight: 3, arbitrary: joinRoomAction },
    { weight: 3, arbitrary: moveObjectAction },
    { weight: 1, arbitrary: sendMessageAction },
    { weight: 1, arbitrary: editVoxelAction },
);

// ─── Action Executor ────────────────────────────────────────────────────────

export async function executeAction(action: Action, connectedUsers: ConnectedUser[]): Promise<void>
{
    switch (action.type)
    {
        case "connect":
        {
            if (connectedUsers.length >= MAX_USERS) return;
            const ctx = harness.connectUser();
            connectedUsers.push(ctx);
            break;
        }
        case "disconnect":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            await harness.disconnectUser(ctx, false);
            connectedUsers.splice(idx, 1);
            break;
        }
        case "joinRoom":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const prevInRoom = RoomManager.currentRoomIDByUserID[ctx.user.id] != undefined;
            await RoomManager.changeUserRoom(ctx.socketUserContext, action.roomID, prevInRoom, false);
            break;
        }
        case "moveObject":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const roomMem = RoomManager.roomRuntimeMemories[roomID];
            if (!roomMem) return;
            const obj = roomMem.playerObjectMemoryByUserID[ctx.user.id];
            if (!obj) return;
            const tr = obj.objectSpawnParams.transform;
            const newTransform = new ObjectTransform(
                Math.max(1, Math.min(31, tr.x + action.dx)),
                tr.y,
                Math.max(1, Math.min(31, tr.z + action.dz)),
                tr.dirX, tr.dirY, tr.dirZ
            );
            RoomManager.updateObjectTransform(ctx.socketUserContext, obj.objectSpawnParams.objectId, newTransform);
            break;
        }
        case "sendMessage":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const roomMem = RoomManager.roomRuntimeMemories[roomID];
            if (!roomMem) return;
            const playerObj = roomMem.playerObjectMemoryByUserID[ctx.user.id];
            if (!playerObj) return;
            RoomManager.sendObjectMessage(
                ctx.socketUserContext,
                new ObjectMessageParams(playerObj.objectSpawnParams.objectId, action.message)
            );
            break;
        }
        case "editVoxel":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = RoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const roomMem = RoomManager.roomRuntimeMemories[roomID];
            if (!roomMem) return;
            const quadIndex = getFirstVoxelQuadIndexInLayer(action.row, action.col, 0);
            if (action.add)
                addVoxelBlock(roomMem.room, quadIndex, [0, 0, 0, 0]);
            else
                removeVoxelBlock(roomMem.room, quadIndex);
            break;
        }
    }
}
