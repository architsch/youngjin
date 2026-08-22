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
import ServerAnalyticsManager from "../analytics/serverAnalyticsManager";
import { FunnelMilestoneEnumMap } from "../analytics/types/funnelMilestone";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../shared/object/types/objectMetadataKey";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/sharedConstants";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import UserCommandUtil from "../user/util/userCommandUtil";
import LatencySimUtil from "../system/util/latencySimUtil";
import ErrorUtil from "../../shared/system/util/errorUtil";
import RoomPickerUtil from "../room/util/roomPickerUtil";
import BotDetectionUtil from "../networking/util/botDetectionUtil";

let io: socketIO.Server;
let signalProcessingInterval: ReturnType<typeof setInterval>;
const staleSocketFirstDetectedAt: {[userID: string]: number} = {};
const RECENT_DISCONNECT_METADATA_TTL_MS = 30000;

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
                if (BotDetectionUtil.isBot(userAgent)) {
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
            try {
                const socketUserContext = new SocketUserContext(socket);
                const user = socketUserContext.user;
                console.log(`(SocketsServer) Client connected :: ${JSON.stringify(user)}`);

                // Player metadata from the previous session is bridged across a reconnect
                // by ServerUserManager.recentDisconnectMetadata: the previous session's
                // removeUserFromRoom snapshots it synchronously before the DBUser write,
                // and changeUserRoom (below) consumes that snapshot, falling back to
                // DBUser. This holds whether the old socket's disconnect fired before
                // (Case B) or after (Case A) this new socket connected — the only thing
                // Case A must do here is proactively evict the still-registered old socket.
                if (ServerUserManager.hasUser(user.id))
                {
                    // Case A: New socket connects BEFORE old disconnect fires (common on
                    // low-latency environments as well as cases in which another tab inside the same
                    // browser window connects to the server while the original tab is still connected).
                    console.warn(`(SocketsServer) Replacing existing socket for userID = ${user.id} (likely page refresh)`);
                    const oldContext = ServerUserManager.getSocketUserContext(user.id)!;

                    ServerUserManager.removeUser(user.id);
                    await ServerRoomManager.changeUserRoom(oldContext, undefined, false, true, false);
                    oldContext.socket.emit("forceRedirect", AddressUtil.getErrorPageURL("auth-duplication"));
                    oldContext.socket.disconnect(true);
                }
                delete staleSocketFirstDetectedAt[user.id];
                ServerUserManager.addUser(socketUserContext);

                socketUserContext.onReceivedSignalFromUser("setObjectTransformSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = SetObjectTransformSignal.decode(bufferState) as SetObjectTransformSignal;
                    ServerObjectManager.onSetObjectTransformSignalReceived(socketUserContext, signal);
                });
                socketUserContext.onReceivedSignalFromUser("userCommandSignal", async (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = UserCommandSignal.decode(bufferState) as UserCommandSignal;
                    await UserCommandUtil.onUserCommandSignalReceived(user, signal);
                });
                // Every signal below is somebody changing the world rather than moving through it,
                // so each one marks this account as having built something. Only the first such
                // signal reaches the database: the session carries the milestones already recorded,
                // so afterwards this costs a string check and nothing else, which is what lets it
                // sit on a path that fires once per block placed. It is deliberately not awaited —
                // measurement must never delay the edit it is measuring — and it never rejects,
                // because ServerAnalyticsManager handles its own failures.
                const recordEdit = () => ServerAnalyticsManager.recordMilestone(
                    user.id, FunnelMilestoneEnumMap.Built, socketUserContext);

                socketUserContext.onReceivedSignalFromUser("addVoxelBlockSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = AddVoxelBlockSignal.decode(bufferState) as AddVoxelBlockSignal;
                    ServerVoxelManager.onAddVoxelBlockSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("moveVoxelBlockSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = MoveVoxelBlockSignal.decode(bufferState) as MoveVoxelBlockSignal;
                    ServerVoxelManager.onMoveVoxelBlockSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("removeVoxelBlockSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = RemoveVoxelBlockSignal.decode(bufferState) as RemoveVoxelBlockSignal;
                    ServerVoxelManager.onRemoveVoxelBlockSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("setVoxelQuadTextureSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = SetVoxelQuadTextureSignal.decode(bufferState) as SetVoxelQuadTextureSignal;
                    ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("addObjectSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = AddObjectSignal.decode(bufferState) as AddObjectSignal;
                    ServerObjectManager.onAddObjectSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("removeObjectSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = RemoveObjectSignal.decode(bufferState) as RemoveObjectSignal;
                    ServerObjectManager.onRemoveObjectSignalReceived(socketUserContext, signal);
                    recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("setObjectMetadataSignal", (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = SetObjectMetadataSignal.decode(bufferState) as SetObjectMetadataSignal;
                    ServerObjectManager.onSetObjectMetadataSignalReceived(socketUserContext, signal);

                    // Chat travels on this signal too: a message is written to the speaker's own
                    // player object as metadata (SpeechBubble), so it arrives here indistinguishable
                    // from an edit except by its key. Counting it as an edit would put every visitor
                    // who says hello into the "built something" figure — the one column the funnel is
                    // read for — so the two are separated here rather than conflated.
                    if (signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage)
                        ServerAnalyticsManager.recordMilestone(
                            user.id, FunnelMilestoneEnumMap.Chatted, socketUserContext);
                    else
                        recordEdit();
                });
                socketUserContext.onReceivedSignalFromUser("requestRoomChangeSignal", async (buffer: ArrayBuffer) => {
                    const bufferState = new BufferState(new Uint8Array(buffer));
                    const signal = RequestRoomChangeSignal.decode(bufferState) as RequestRoomChangeSignal;
                    await ServerRoomManager.onRequestRoomChangeSignalReceived(socketUserContext, signal);
                });

                socket.on("disconnect", async () => {
                    console.log(`(SocketsServer) Client disconnected :: ${JSON.stringify(user)}`);

                    if (ServerUserManager.getSocketUserContext(user.id) != socketUserContext)
                    {
                        // This socket was already replaced by a newer connection (page
                        // refresh), or was cleaned up earlier. The replacement logic in
                        // the connection handler already captured the player metadata, so
                        // there is nothing left to do.
                        console.warn(`(SocketsServer) Skipping stale disconnect handler (userID = ${user.id})`);
                        return;
                    }

                    // ServerUserManager.removeUserFromRoom (invoked via changeUserRoom)
                    // snapshots playerMetadata synchronously into recentDisconnectMetadata
                    // before kicking off the DBUser write, so a near-instant reconnect can
                    // still read the latest chat message etc.
                    ServerUserManager.removeUser(user.id);
                    await ServerRoomManager.changeUserRoom(socketUserContext, undefined, false, true, false);
                });

                // Try to join the best room. If it is full, fall back to a room that is NOT full.
                const roomID = await RoomPickerUtil.pickBestRoomID(socketUserContext, "appStart");
                const roomChangeResult = await ServerRoomManager.changeUserRoom(socketUserContext, roomID, false, false, true);
                ServerRoomManager.notifyRoomChangeRejection(socketUserContext, roomChangeResult);
            } catch (err) {
                console.error(`Exception while establishing a socket connection with a client :: Error: ${ErrorUtil.getErrorMessage(err)}`);
                socket.disconnect(true);
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
                        await ServerRoomManager.changeUserRoom(ctx, undefined, false, true, false);
                    }
                }
                else
                {
                    delete staleSocketFirstDetectedAt[userID];
                }
            }

            // Evict expired entries from the disconnect-metadata buffer.
            ServerUserManager.evictExpiredDisconnectMetadata(RECENT_DISCONNECT_METADATA_TTL_MS);
        }, 5000);
    },
    saveAndDisconnectAllUsers: async (): Promise<void> =>
    {
        await ServerRoomManager.saveAllUsersPlayerMetadata(ServerUserManager.socketUserContexts);

        for (const [userID, socketUserContext] of Object.entries(ServerUserManager.socketUserContexts))
        {
            await ServerRoomManager.changeUserRoom(socketUserContext, undefined, false, false, false);
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

            // Both are set after the spread, so whatever the client put in the handshake is
            // replaced rather than trusted. The funnel travels separately from the user because it
            // is server-side measurement state and is deliberately not part of User.
            socket.handshake.auth = { ...socket.handshake.auth, user, funnel: dbUser.funnel ?? "" };
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
