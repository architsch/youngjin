import http from "http";
import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/user/types/user";
import AddressUtil from "../networking/util/addressUtil";
import * as cookie from "cookie";
import UserTokenUtil from "../user/util/userTokenUtil";
import CookieUtil from "../networking/util/cookieUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";
import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import ServerRoomManager from "../room/serverRoomManager";
import ServerUserManager from "../user/serverUserManager";
import ServerObjectManager from "../object/serverObjectManager";
import ServerVoxelManager from "../voxel/serverVoxelManager";
import SocketUserContext from "./types/socketUserContext";
import BufferState from "../../shared/networking/types/bufferState";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/sharedConstants";
import DBSearchUtil from "../db/util/dbSearchUtil";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import UserCommandUtil from "../user/util/userCommandUtil";
import UserGameplayState from "../user/types/userGameplayState";
import LatencySimUtil from "../system/util/latencySimUtil";

let io: socketIO.Server;
let signalProcessingInterval: NodeJS.Timeout;
const recentDisconnectGameplayStates: {[userID: string]: {state: UserGameplayState, timestamp: number}} = {};
const staleSocketFirstDetectedAt: {[userID: string]: number} = {};

const SocketsServer =
{
    init: (server: http.Server): void =>
    {
        io = new socketIO.Server(server, {
            pingTimeout: 5000, // default: 20000
            pingInterval: 10000, // default: 25000
            cors: {
                // Same-origin setup: page at app.thingspool.net → socket at app.thingspool.net
                origin: AddressUtil.getEnvDynamicURL(),
                methods: ["GET", "POST"],
            },
            allowEIO3: true,
            transports: ["websocket", "polling"],
            allowRequest: (req, callback) => {
                const userAgent = req.headers["user-agent"] || "";
                console.log(`[allowRequest] User-Agent: ${userAgent}, URL: ${req.url}`);

                // Block known bot/crawler user-agents from establishing socket connections.
                const isBot = /bot|crawler|spider|robot|crawling/i.test(userAgent);

                if (isBot) {
                    console.log(`[allowRequest] Blocking bot: ${userAgent}`);
                    return callback(null, false); // Reject the connection with 403 (forbidden)
                }

                console.log(`[allowRequest] Allowing connection from: ${userAgent}`);
                callback(null, true);
            },
        });

        io.engine.on("connection_error", (err) => {
            console.error(`Socket connection error :: (code = ${err.code}, message = ${err.message}, req = ${JSON.stringify(err.req)}, context = ${JSON.stringify(err.context)})`);
        });

        io.use(makeAuthMiddleware((user: User) => true));

        // Simulated network latency for Socket.IO (dev only — controlled by SIMULATED_LATENCY_MS env var)
        if (LatencySimUtil.networkLatencyEnabled)
        {
            io.use(async (_socket, next) => {
                await LatencySimUtil.simulateNetworkLatency();
                next();
            });
        }

        io.on("connection", async (socket: socketIO.Socket) => {
            const socketUserContext = new SocketUserContext(socket);
            const user = socketUserContext.user;
            console.log(`(SocketsServer) Client connected :: ${JSON.stringify(user)}`);

            // Cached gameplay state from a previous session (used for reconnection).
            // This is passed to changeUserRoom so it can restore position without a DB lookup.
            let cachedGameplayState: UserGameplayState | undefined;

            if (ServerUserManager.hasUser(user.id))
            {
                // Case A: New socket connects BEFORE old disconnect fires (common on
                // low-latency environments as well as cases in which another tab inside the same
                // browser window connects to the server while the original tab is still connected).
                // Capture the old session's gameplay state from runtime memory, clean it up,
                // and pass it to changeUserRoom so the player spawns at the correct position.
                console.warn(`(SocketsServer) Replacing existing socket for userID = ${user.id} (likely page refresh)`);
                const oldContext = ServerUserManager.getSocketUserContext(user.id)!;
                const oldRoomID = ServerRoomManager.currentRoomIDByUserID[user.id];
                const oldRoomMemory = oldRoomID ? ServerRoomManager.roomRuntimeMemories[oldRoomID] : undefined;
                cachedGameplayState = oldRoomMemory ? ServerUserManager.getUserGameplayState(oldContext, oldRoomMemory) : undefined;

                ServerUserManager.removeUser(user.id);
                await ServerRoomManager.changeUserRoom(oldContext, undefined, false, true);
                oldContext.socket.emit("forceRedirect", AddressUtil.getErrorPageURL("auth-duplication"));
                oldContext.socket.disconnect(true);

                if (cachedGameplayState)
                    user.lastRoomID = cachedGameplayState.lastRoomID;
            }
            else
            {
                // Case B: Old disconnect already fired BEFORE this new socket
                // connected (common on higher-latency environments).
                // The disconnect handler cached the gameplay state in memory.
                // Restore it here because the DB write from the disconnect handler
                // may not have completed before the socket auth middleware queried
                // the DB for this new connection.
                const cached = recentDisconnectGameplayStates[user.id];
                if (cached)
                {
                    console.log(`(SocketsServer) Restoring cached gameplay state for userID = ${user.id}`);
                    cachedGameplayState = cached.state;
                    user.lastRoomID = cached.state.lastRoomID;
                }
            }
            delete recentDisconnectGameplayStates[user.id];
            delete staleSocketFirstDetectedAt[user.id];
            ServerUserManager.addUser(socketUserContext);

            socketUserContext.onReceivedSignalFromUser("setObjectTransformSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = SetObjectTransformSignal.decode(bufferState) as SetObjectTransformSignal;
                ServerObjectManager.onSetObjectTransformSignalReceived(socketUserContext, params.objectId, params.transform);
            });

            socketUserContext.onReceivedSignalFromUser("userCommandSignal", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = UserCommandSignal.decode(bufferState) as UserCommandSignal;
                await UserCommandUtil.onUserCommandSignalReceived(user, params);
            });

            socketUserContext.onReceivedSignalFromUser("addVoxelBlockSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = AddVoxelBlockSignal.decode(bufferState) as AddVoxelBlockSignal;
                ServerVoxelManager.onAddVoxelBlockSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("moveVoxelBlockSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = MoveVoxelBlockSignal.decode(bufferState) as MoveVoxelBlockSignal;
                ServerVoxelManager.onMoveVoxelBlockSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("removeVoxelBlockSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RemoveVoxelBlockSignal.decode(bufferState) as RemoveVoxelBlockSignal;
                ServerVoxelManager.onRemoveVoxelBlockSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("setVoxelQuadTextureSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = SetVoxelQuadTextureSignal.decode(bufferState) as SetVoxelQuadTextureSignal;
                ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("addObjectSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = AddObjectSignal.decode(bufferState) as AddObjectSignal;
                ServerObjectManager.onAddObjectSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("removeObjectSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RemoveObjectSignal.decode(bufferState) as RemoveObjectSignal;
                ServerObjectManager.onRemoveObjectSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("setObjectMetadataSignal", (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = SetObjectMetadataSignal.decode(bufferState) as SetObjectMetadataSignal;
                ServerObjectManager.onSetObjectMetadataSignalReceived(socketUserContext, params);
            });

            socketUserContext.onReceivedSignalFromUser("requestRoomChangeSignal", async (buffer: ArrayBuffer) => {
                const bufferState = new BufferState(new Uint8Array(buffer));
                const params = RequestRoomChangeSignal.decode(bufferState) as RequestRoomChangeSignal;
                await ServerRoomManager.onRequestRoomChangeSignalReceived(socketUserContext, params);
            });

            socket.on("disconnect", async () => {
                console.log(`(SocketsServer) Client disconnected :: ${JSON.stringify(user)}`);

                if (ServerUserManager.getSocketUserContext(user.id) != socketUserContext)
                {
                    // This socket was already replaced by a newer connection (page
                    // refresh), or was cleaned up earlier.  The replacement logic in
                    // the connection handler already captured the gameplay state, so
                    // there is nothing left to do.
                    console.warn(`(SocketsServer) Skipping stale disconnect handler (userID = ${user.id})`);
                    return;
                }

                // Cache the gameplay state in memory so that a new connection
                // arriving shortly after this disconnect can restore it, even if the
                // DB write below hasn't completed by the time the new socket's auth
                // middleware queries the DB.
                const roomID = ServerRoomManager.currentRoomIDByUserID[user.id];
                const roomMem = roomID ? ServerRoomManager.roomRuntimeMemories[roomID] : undefined;
                const gameplayState = roomMem ? ServerUserManager.getUserGameplayState(socketUserContext, roomMem) : undefined;
                if (gameplayState)
                    recentDisconnectGameplayStates[user.id] = {state: gameplayState, timestamp: Date.now()};

                ServerUserManager.removeUser(user.id);
                await ServerRoomManager.changeUserRoom(socketUserContext, undefined, false, true);
            });

            // Determine which room the user should join.
            // Priority:
            //   1. targetRoomID from socket handshake (URL-based room access: /mypage/:roomID)
            //   2. user.lastRoomID (the room the user was last in)
            //   3. Hub room (fallback)
            const targetRoomID = socket.handshake.auth.targetRoomID as string | undefined;
            const preferredRoomID = (targetRoomID && targetRoomID.length > 0)
                ? targetRoomID
                : user.lastRoomID;

            if (!(await ServerRoomManager.changeUserRoom(socketUserContext, preferredRoomID, false, false, cachedGameplayState)))
            {
                // Check in-memory rooms first to avoid a Firestore query
                let hubRoomID: string | undefined;
                for (const [roomID, mem] of Object.entries(ServerRoomManager.roomRuntimeMemories))
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
                    await ServerRoomManager.changeUserRoom(socketUserContext, hubRoomID, false, false);
            }
        });

        // Sending a separate packet for every individual signal is too wasteful of network resources.
        // Therefore, we should batch signals that are very close to one another in time
        // and send those batches at regular intervals instead.
        signalProcessingInterval = setInterval(() => {
            for (const userID in ServerUserManager.socketUserContexts)
            {
                ServerUserManager.socketUserContexts[userID].processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);

        setInterval(async () => {
            // Periodically remove users whose socket connection is no longer alive.
            // This catches edge cases where the "disconnect" event fails to fire
            // (e.g., abrupt browser crash with no TCP FIN, or a swallowed error in
            // the disconnect handler).
            const currTime = Date.now();
            for (const [userID, ctx] of Object.entries(ServerUserManager.socketUserContexts))
            {
                if (!ctx.socket.connected)
                {
                    if (staleSocketFirstDetectedAt[userID] == undefined)
                    {
                        staleSocketFirstDetectedAt[userID] = currTime;
                    }
                    else if (currTime - staleSocketFirstDetectedAt[userID] > 5000)
                    {
                        console.warn(`(SocketsServer) Stale socket detected, cleaning up :: userID = ${userID}`);
                        delete staleSocketFirstDetectedAt[userID];
                        ServerUserManager.removeUser(userID);
                        await ServerRoomManager.changeUserRoom(ctx, undefined, false, true);
                    }
                }
                else
                {
                    delete staleSocketFirstDetectedAt[userID];
                }
            }

            // Periodically evict expired gameplay state cache entries.
            const now = Date.now();
            for (const [userID, cached] of Object.entries(recentDisconnectGameplayStates))
            {
                if (now - cached.timestamp > 30000)
                    delete recentDisconnectGameplayStates[userID];
            }
        }, 5000);
    },
    saveAndDisconnectAllUsers: async (): Promise<void> =>
    {
        await ServerRoomManager.saveAllUserGameplayStates(ServerUserManager.socketUserContexts);

        for (const [userID, socketUserContext] of Object.entries(ServerUserManager.socketUserContexts))
        {
            await ServerRoomManager.changeUserRoom(socketUserContext, undefined, false, false);
            socketUserContext.socket.disconnect(true);
        }
    },
}

function makeAuthMiddleware(passCondition: (user: User) => Boolean): SocketMiddleware
{
    return async (socket: socketIO.Socket, next: (err?: socketIO.ExtendedError) => void) =>
    {
        try
        {
            const cookieStr = socket.request.headers.cookie;
            console.log(`Authenticating socket (ID: ${socket.id})`);
            if (!cookieStr)
            {
                next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
                return;
            }
            const cookieMap = cookie.parse(cookieStr);
            const token = cookieMap[CookieUtil.getAuthTokenName()];
            if (!token)
            {
                next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
                return;
            }
            const userId = UserTokenUtil.getUserIdFromToken(token);
            if (!userId)
            {
                next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
                return;
            }

            const dbUser = await DBUserUtil.findUserById(userId);
            if (!dbUser)
            {
                next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
                return;
            }
            const user = DBUserUtil.fromDBType(dbUser);

            if (!passCondition(user))
            {
                next(new Error(AddressUtil.getErrorPageURL("auth-no-permission")));
                return;
            }

            socket.handshake.auth = { ...socket.handshake.auth, user };
            next();
        }
        catch (err)
        {
            console.error(`Socket auth error: ${err}`);
            next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
        }
    }
}

export default SocketsServer;
