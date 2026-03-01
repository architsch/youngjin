import http from "http";
import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/user/types/user";
import AddressUtil from "../networking/util/addressUtil";
import * as cookie from "cookie";
import UserTokenUtil from "../user/util/userTokenUtil";
import CookieUtil from "../networking/util/cookieUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams"
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
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
import UserManager from "../user/userManager";

let io: socketIO.Server;
let signalProcessingInterval: NodeJS.Timeout;
const recentDisconnectGameplayStates: {[userID: string]: {state: UserGameplayState, timestamp: number}} = {};
const staleSocketFirstDetectedAt: {[userID: string]: number} = {};

const Sockets =
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
            console.log(`(Sockets) Client connected :: ${JSON.stringify(user)}`);

            if (UserManager.hasUser(user.id))
            {
                // Case A: New socket connects BEFORE old disconnect fires (common on
                // low-latency environments as well as cases in which another tab inside the same
                // browser window connects to the server while the original tab is still connected).
                // Capture the old session's gameplay state from runtime memory, clean it up,
                // and update the new socket's user object so the player spawns at the correct position.
                console.warn(`(Sockets) Replacing existing socket for userID = ${user.id} (likely page refresh)`);
                const oldContext = UserManager.getSocketUserContext(user.id)!;
                const oldRoomID = RoomManager.currentRoomIDByUserID[user.id];
                const oldRoomMemory = oldRoomID ? RoomManager.roomRuntimeMemories[oldRoomID] : undefined;
                const oldGameplayState = oldRoomMemory ? getUserGameplayState(oldContext, oldRoomMemory) : undefined;

                UserManager.removeUser(user.id);
                await RoomManager.changeUserRoom(oldContext, undefined, false, true);
                oldContext.socket.emit("forceRedirect", AddressUtil.getErrorPageURL("auth-duplication"));
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
                    console.log(`(Sockets) Restoring cached gameplay state for userID = ${user.id}`);
                    user.applyGameplayState(cached.state);
                }
            }
            delete recentDisconnectGameplayStates[user.id];
            delete staleSocketFirstDetectedAt[user.id];
            UserManager.addUser(socketUserContext);

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
                console.log(`(Sockets) Client disconnected :: ${JSON.stringify(user)}`);

                if (UserManager.getSocketUserContext(user.id) != socketUserContext)
                {
                    // This socket was already replaced by a newer connection (page
                    // refresh), or was cleaned up earlier.  The replacement logic in
                    // the connection handler already captured the gameplay state, so
                    // there is nothing left to do.
                    console.warn(`(Sockets) Skipping stale disconnect handler (userID = ${user.id})`);
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

                UserManager.removeUser(user.id);
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

        // Sending a separate packet for every individual signal is too wasteful of network resources.
        // Therefore, we should batch signals that are very close to one another in time
        // and send those batches at regular intervals instead.
        signalProcessingInterval = setInterval(() => {
            for (const userID in UserManager.socketUserContexts)
            {
                UserManager.socketUserContexts[userID].processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);

        setInterval(async () => {
            // Periodically remove users whose socket connection is no longer alive.
            // This catches edge cases where the "disconnect" event fails to fire
            // (e.g., abrupt browser crash with no TCP FIN, or a swallowed error in
            // the disconnect handler).
            const currTime = Date.now();
            for (const [userID, ctx] of Object.entries(UserManager.socketUserContexts))
            {
                if (!ctx.socket.connected)
                {
                    if (staleSocketFirstDetectedAt[userID] == undefined)
                    {
                        staleSocketFirstDetectedAt[userID] = currTime;
                    }
                    else if (currTime - staleSocketFirstDetectedAt[userID] > 5000)
                    {
                        console.warn(`(Sockets) Stale socket detected, cleaning up :: userID = ${userID}`);
                        delete staleSocketFirstDetectedAt[userID];
                        UserManager.removeUser(userID);
                        await RoomManager.changeUserRoom(ctx, undefined, false, true);
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
        await RoomManager.saveAllUserGameplayStates(UserManager.socketUserContexts);

        for (const [userID, socketUserContext] of Object.entries(UserManager.socketUserContexts))
        {
            await RoomManager.changeUserRoom(socketUserContext, undefined, false, false);
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

            socket.handshake.auth = user;
            next();
        }
        catch (err)
        {
            console.error(`Socket auth error: ${err}`);
            next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
        }
    }
}

export default Sockets;
