import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams"
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
import User from "../../shared/user/types/user";
import RoomManager from "../room/roomManager";
import { getUserGameplayState } from "../room/util/roomUserUtil";
import SocketUserContext from "./types/socketUserContext";
import BufferState from "../../shared/networking/types/bufferState";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/sharedConstants";
import DBSearchUtil from "../db/util/dbSearchUtil";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import UserCommandParams from "../../shared/user/types/userCommandParams";
import UserCommandUtil from "../user/util/userCommandUtil";
import UserGameplayState from "../user/types/userGameplayState";
import LatencySimUtil from "../system/util/latencySimUtil";

let nsp: socketIO.Namespace;
let signalProcessingInterval: NodeJS.Timeout;
const socketUserContexts: {[userID: string]: SocketUserContext} = {};
const recentDisconnectGameplayStates: {[userID: string]: {state: UserGameplayState, timestamp: number}} = {};
const GAMEPLAY_STATE_CACHE_TTL = 60_000;

const GameSockets =
{
    saveAndDisconnectAllUsers: async (): Promise<void> =>
    {
        await RoomManager.saveAllUserGameplayStates(socketUserContexts);

        for (const [userID, socketUserContext] of Object.entries(socketUserContexts))
        {
            await RoomManager.changeUserRoom(socketUserContext, undefined, false, false);
            socketUserContext.socket.disconnect(true);
        }
    },
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        // Simulated network latency for Socket.IO (dev only — controlled by SIMULATED_LATENCY_MS env var)
        if (LatencySimUtil.networkLatencyEnabled)
        {
            nsp.use(async (_socket, next) => {
                await LatencySimUtil.simulateNetworkLatency();
                next();
            });
        }

        nsp.on("connection", async (socket: socketIO.Socket) => {
            const socketUserContext = new SocketUserContext(socket);
            const user: User = socket.handshake.auth as User;
            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);
            
            if (socketUserContexts[user.id] != undefined)
            {
                // Case A: New socket connects BEFORE old disconnect fires (common on
                // low-latency environments as well as cases in which another tab inside the same
                // browser window connects to the server while the original tab is still connected).
                // Capture the old session's gameplay state from runtime memory, clean it up,
                // and update the new socket's user object so the player spawns at the correct position.
                console.warn(`(GameSockets) Replacing existing socket for userID = ${user.id} (likely page refresh)`);
                const oldContext = socketUserContexts[user.id];
                const oldRoomID = RoomManager.currentRoomIDByUserID[user.id];
                const oldRoomMemory = oldRoomID ? RoomManager.roomRuntimeMemories[oldRoomID] : undefined;
                const oldGameplayState = oldRoomMemory ? getUserGameplayState(oldContext, oldRoomMemory) : undefined;

                delete socketUserContexts[user.id];
                await RoomManager.changeUserRoom(oldContext, undefined, false, true);
                oldContext.socket.emit("forceRedirect", "/error/auth-duplication");
                oldContext.socket.disconnect(true);

                if (oldGameplayState)
                    user.applyGameplayState(oldGameplayState);
            }
            else
            {
                // Case B: Old disconnect already fired BEFORE this new socket
                // connected (common on higher-latency environments).
                // The disconnect handler cached the gameplay state in memory.
                // Apply it here because the DB write from the disconnect handler
                // may not have completed before the socket auth middleware queried
                // the DB for this new connection.
                const cached = recentDisconnectGameplayStates[user.id];
                if (cached)
                {
                    console.log(`(GameSockets) Restoring cached gameplay state for userID = ${user.id}`);
                    user.applyGameplayState(cached.state);
                }
            }
            delete recentDisconnectGameplayStates[user.id];
            socketUserContexts[user.id] = socketUserContext;

            socketUserContext.onReceivedSignalFromUser("objectSyncParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectSyncParams.decode(bufferState) as ObjectSyncParams;
                RoomManager.updateObjectTransform(socketUserContext, params.objectId, params.transform);
            });

            socketUserContext.onReceivedSignalFromUser("objectMessageParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = ObjectMessageParams.decode(bufferState) as ObjectMessageParams;
                RoomManager.sendObjectMessage(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("userCommandParams", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UserCommandParams.decode(bufferState) as UserCommandParams;
                await UserCommandUtil.handleCommand(user, params);
            });

            socketUserContext.onReceivedSignalFromUser("updateVoxelGridParams", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UpdateVoxelGridParams.decode(bufferState) as UpdateVoxelGridParams;
                RoomManager.updateVoxelGrid(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("roomChangeRequestParams", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RoomChangeRequestParams.decode(bufferState) as RoomChangeRequestParams;
                await RoomManager.changeUserRoom(socketUserContext, params.roomID, true, false);
            });

            socket.on("disconnect", async () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);

                if (socketUserContexts[user.id] != socketUserContext)
                {
                    // This socket was already replaced by a newer connection (page
                    // refresh), or was cleaned up earlier.  The replacement logic in
                    // the connection handler already captured the gameplay state, so
                    // there is nothing left to do.
                    console.warn(`(GameSockets) Skipping stale disconnect handler (userID = ${user.id})`);
                    return;
                }

                // Cache the gameplay state in memory so that a new connection
                // arriving shortly after this disconnect can restore it, even if the
                // DB write below hasn't completed by the time the new socket's auth
                // middleware queries the DB.
                const roomID = RoomManager.currentRoomIDByUserID[user.id];
                const roomMem = roomID ? RoomManager.roomRuntimeMemories[roomID] : undefined;
                const gameplayState = roomMem ? getUserGameplayState(socketUserContext, roomMem) : undefined;
                if (gameplayState)
                    recentDisconnectGameplayStates[user.id] = {state: gameplayState, timestamp: Date.now()};

                delete socketUserContexts[user.id];
                await RoomManager.changeUserRoom(socketUserContext, undefined, false, true);
            });

            // Each connected client (user) should automatically join a room.
            // If the user has lastRoomID,
            //    -> The user should join the room whose ID is lastRoomID.
            // If the user either has no lastRoomID or doesn't have a lastRoomID which corresponds to an existing room,
            //    -> The user should join the "hub" room.
            if (!(await RoomManager.changeUserRoom(socketUserContext, user.lastRoomID, false, false)))
            {
                // Check in-memory rooms first to avoid a Firestore query
                let hubRoomID: string | undefined;
                for (const [roomID, mem] of Object.entries(RoomManager.roomRuntimeMemories))
                {
                    if (mem.room.roomType === RoomTypeEnumMap.Hub)
                    {
                        hubRoomID = roomID;
                        break;
                    }
                }
                if (!hubRoomID)
                {
                    const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
                    if (roomSearchResult.success && roomSearchResult.data.length > 0)
                        hubRoomID = roomSearchResult.data[0].id as string;
                }
                if (hubRoomID)
                    await RoomManager.changeUserRoom(socketUserContext, hubRoomID, false, false);
            }
        });

        signalProcessingInterval = setInterval(() => {
            for (const socketUserContext of Object.values(socketUserContexts))
            {
                socketUserContext.processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);

        // Periodically remove users whose socket connection is no longer alive.
        // This catches edge cases where the "disconnect" event fails to fire
        // (e.g., abrupt browser crash with no TCP FIN, or a swallowed error in
        // the disconnect handler).
        setInterval(async () => {
            for (const [userID, ctx] of Object.entries(socketUserContexts))
            {
                if (!ctx.socket.connected)
                {
                    console.warn(`(GameSockets) Stale socket detected, cleaning up :: userID = ${userID}`);
                    delete socketUserContexts[userID];
                    await RoomManager.changeUserRoom(ctx, undefined, false, false);
                }
            }

            // Evict expired gameplay state cache entries.
            const now = Date.now();
            for (const [userID, cached] of Object.entries(recentDisconnectGameplayStates))
            {
                if (now - cached.timestamp > GAMEPLAY_STATE_CACHE_TTL)
                    delete recentDisconnectGameplayStates[userID];
            }
        }, 30_000);
    },
}

export default GameSockets;