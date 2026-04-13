/**
 * Extended action vocabulary for the scenario-based integration test framework.
 *
 * Every atomic operation the game supports is represented as an Action type.
 * The `executeAction` function maps each action to the appropriate harness/manager call.
 *
 * For property-based testing, fast-check arbitraries are provided for each action type.
 */
import fc from "fast-check";
import { harness, ConnectedUser } from "./serverHarness";
import { MockUserOverrides } from "./mockUser";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerVoxelManager from "../../../src/server/voxel/serverVoxelManager";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";

// ─── Action Types ───────────────────────────────────────────────────────────

export type Action =
    // Connection lifecycle
    | { type: "connect"; overrides?: MockUserOverrides }
    | { type: "disconnect"; userIndex: number; saveState?: boolean }
    | { type: "reconnectCaseA"; userIndex: number }
    | { type: "reconnectCaseB"; userIndex: number }
    // Room
    | { type: "joinRoom"; userIndex: number; roomID: string }
    | { type: "seedRoom"; roomID: string; roomType?: RoomType }
    // Object — player movement
    | { type: "moveObject"; userIndex: number; x: number; y: number; z: number;
        dirX?: number; dirY?: number; dirZ?: number }
    // Object — metadata (chat message)
    | { type: "sendMessage"; userIndex: number; message: string }
    // Voxel operations
    | { type: "addVoxel"; userIndex: number; row: number; col: number; layer: number;
        textures?: [number, number, number, number, number, number] }
    | { type: "removeVoxel"; userIndex: number; row: number; col: number; layer: number }
    | { type: "moveVoxel"; userIndex: number; row: number; col: number; layer: number;
        dRow: number; dCol: number; dLayer: number }
    | { type: "setVoxelTexture"; userIndex: number; row: number; col: number;
        layer: number; quadOffset: number; textureIndex: number }
    // Concurrency (for race condition testing)
    | { type: "parallel"; groups: Action[][] }
    // Server lifecycle
    | { type: "gracefulShutdown" }
    // Timing / latency control
    | { type: "setLatency"; enabled: boolean; minMs?: number; maxMs?: number };

// ─── Action Executor ────────────────────────────────────────────────────────

/**
 * Executes a single action against the harness, mutating `connectedUsers` as needed.
 * Returns silently if the action targets a non-existent user or room (graceful no-op).
 */
export async function executeAction(action: Action, connectedUsers: ConnectedUser[]): Promise<void>
{
    switch (action.type)
    {
        case "connect":
        {
            const ctx = harness.connectUser(action.overrides);
            connectedUsers.push(ctx);
            break;
        }
        case "disconnect":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            await harness.disconnectUser(ctx, action.saveState ?? false);
            connectedUsers.splice(idx, 1);
            break;
        }
        case "reconnectCaseA":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const oldCtx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[oldCtx.user.id];
            if (!roomID) return; // Can't reconnect if not in a room
            const newCtx = await harness.reconnectCaseA(oldCtx);
            connectedUsers[idx] = newCtx;
            // Re-seed room if it was unloaded, then rejoin
            if (!harness.isRoomLoaded(roomID))
                harness.seedRoom(roomID);
            await harness.joinRoom(newCtx, roomID);
            break;
        }
        case "reconnectCaseB":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const oldCtx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[oldCtx.user.id];
            if (!roomID) return;
            const newCtx = await harness.reconnectCaseB(oldCtx);
            connectedUsers[idx] = newCtx;
            if (!harness.isRoomLoaded(roomID))
                harness.seedRoom(roomID);
            await harness.joinRoom(newCtx, roomID);
            break;
        }
        case "joinRoom":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            await harness.joinRoom(ctx, action.roomID);
            break;
        }
        case "seedRoom":
        {
            harness.seedRoom(action.roomID, action.roomType ?? RoomTypeEnumMap.Regular);
            break;
        }
        case "moveObject":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const playerObj = harness.getPlayerObject(ctx.user.id);
            if (!playerObj) return;
            const transform = new ObjectTransform(
                {x: action.x, y: action.y, z: action.z},
                {x: action.dirX ?? 0, y: action.dirY ?? 0, z: action.dirZ ?? 1},
            );
            const signal = new SetObjectTransformSignal(roomID, playerObj.objectId, transform, false);
            ServerObjectManager.onSetObjectTransformSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "sendMessage":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const playerObj = harness.getPlayerObject(ctx.user.id);
            if (!playerObj) return;
            const signal = new SetObjectMetadataSignal(roomID, playerObj.objectId, 0, action.message);
            ServerObjectManager.onSetObjectMetadataSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "addVoxel":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(action.row, action.col, action.layer);
            const textures = action.textures ?? [0, 0, 0, 0, 0, 0];
            const signal = new AddVoxelBlockSignal(roomID, quadIndex, textures);
            ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "removeVoxel":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(action.row, action.col, action.layer);
            const signal = new RemoveVoxelBlockSignal(roomID, quadIndex);
            ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "moveVoxel":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(action.row, action.col, action.layer);
            const signal = new MoveVoxelBlockSignal(roomID, quadIndex, action.dRow, action.dCol, action.dLayer);
            ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "setVoxelTexture":
        {
            if (connectedUsers.length === 0) return;
            const idx = action.userIndex % connectedUsers.length;
            const ctx = connectedUsers[idx];
            const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
            if (!roomID) return;
            const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(action.row, action.col, action.layer)
                + action.quadOffset;
            const signal = new SetVoxelQuadTextureSignal(roomID, quadIndex, action.textureIndex);
            ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx.socketUserContext, signal);
            break;
        }
        case "parallel":
        {
            await Promise.allSettled(
                action.groups.map(async (group) => {
                    for (const a of group)
                        await executeAction(a, connectedUsers);
                })
            );
            break;
        }
        case "gracefulShutdown":
        {
            await harness.gracefulShutdown();
            connectedUsers.length = 0;
            break;
        }
        case "setLatency":
        {
            harness.setLatency(action.enabled, action.minMs ?? 0, action.maxMs ?? 5);
            break;
        }
    }
}

// ─── fast-check Arbitraries ─────────────────────────────────────────────────

/** Configuration for property-based test profiles. */
export interface ActionWeights
{
    connect?: number;
    disconnect?: number;
    joinRoom?: number;
    moveObject?: number;
    sendMessage?: number;
    addVoxel?: number;
    removeVoxel?: number;
    reconnectA?: number;
    reconnectB?: number;
}

export const DEFAULT_MAX_USERS = 10;
export const DEFAULT_ROOM_IDS = ["room-A", "room-B", "room-C"];

export function buildActionArbitrary(
    maxUsers: number = DEFAULT_MAX_USERS,
    roomIDs: string[] = DEFAULT_ROOM_IDS,
    weights: ActionWeights = {},
): fc.Arbitrary<Action>
{
    const w = {
        connect: weights.connect ?? 2,
        disconnect: weights.disconnect ?? 2,
        joinRoom: weights.joinRoom ?? 3,
        moveObject: weights.moveObject ?? 3,
        sendMessage: weights.sendMessage ?? 1,
        addVoxel: weights.addVoxel ?? 1,
        removeVoxel: weights.removeVoxel ?? 0,
        reconnectA: weights.reconnectA ?? 0,
        reconnectB: weights.reconnectB ?? 0,
    };

    const arbs: {weight: number; arbitrary: fc.Arbitrary<Action>}[] = [];

    if (w.connect > 0)
        arbs.push({weight: w.connect, arbitrary: fc.record({
            type: fc.constant("connect" as const),
            overrides: fc.record({
                lastX: fc.double({min: 2, max: 30, noNaN: true}),
                lastZ: fc.double({min: 2, max: 30, noNaN: true}),
            }),
        })});

    if (w.disconnect > 0)
        arbs.push({weight: w.disconnect, arbitrary: fc.nat({max: maxUsers - 1}).map<Action>(i => ({
            type: "disconnect", userIndex: i, saveState: false,
        }))});

    if (w.joinRoom > 0)
        arbs.push({weight: w.joinRoom, arbitrary: fc.record({
            type: fc.constant("joinRoom" as const),
            userIndex: fc.nat({max: maxUsers - 1}),
            roomID: fc.constantFrom(...roomIDs),
        })});

    if (w.moveObject > 0)
        arbs.push({weight: w.moveObject, arbitrary: fc.record({
            type: fc.constant("moveObject" as const),
            userIndex: fc.nat({max: maxUsers - 1}),
            x: fc.double({min: 2, max: 30, noNaN: true}),
            y: fc.constant(0),
            z: fc.double({min: 2, max: 30, noNaN: true}),
        })});

    if (w.sendMessage > 0)
        arbs.push({weight: w.sendMessage, arbitrary: fc.record({
            type: fc.constant("sendMessage" as const),
            userIndex: fc.nat({max: maxUsers - 1}),
            message: fc.string({minLength: 1, maxLength: 32}),
        })});

    if (w.addVoxel > 0)
        arbs.push({weight: w.addVoxel, arbitrary: fc.record({
            type: fc.constant("addVoxel" as const),
            userIndex: fc.nat({max: maxUsers - 1}),
            row: fc.nat({min: 2, max: 29}),
            col: fc.nat({min: 2, max: 29}),
            layer: fc.nat({min: 0, max: 7}),
        })});

    if (w.removeVoxel > 0)
        arbs.push({weight: w.removeVoxel, arbitrary: fc.record({
            type: fc.constant("removeVoxel" as const),
            userIndex: fc.nat({max: maxUsers - 1}),
            row: fc.nat({min: 2, max: 29}),
            col: fc.nat({min: 2, max: 29}),
            layer: fc.nat({min: 0, max: 7}),
        })});

    if (w.reconnectA > 0)
        arbs.push({weight: w.reconnectA, arbitrary: fc.nat({max: maxUsers - 1}).map<Action>(i => ({
            type: "reconnectCaseA", userIndex: i,
        }))});

    if (w.reconnectB > 0)
        arbs.push({weight: w.reconnectB, arbitrary: fc.nat({max: maxUsers - 1}).map<Action>(i => ({
            type: "reconnectCaseB", userIndex: i,
        }))});

    return fc.oneof(...arbs);
}
