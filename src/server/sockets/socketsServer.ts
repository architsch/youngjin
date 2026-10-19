import http from "http";
import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/user/types/user";
import AddressUtil from "../networking/util/addressUtil";
import * as cookie from "cookie";
import UserTokenUtil from "../user/util/userTokenUtil";
import CookieUtil from "../networking/util/cookieUtil";
import DBUserUtil from "../db/util/dbUserUtil";
import ServerRoomManager from "../room/serverRoomManager";
import ServerUserManager from "../user/serverUserManager";
import SocketUserContext from "./types/socketUserContext";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../shared/system/sharedConstants";
import LatencySimUtil from "../system/util/latencySimUtil";
import ErrorUtil from "../../shared/system/util/errorUtil";
import BotDetectionUtil from "../networking/util/botDetectionUtil";
import UserSessionUtil from "../user/util/userSessionUtil";
import UserSignalDispatchUtil from "../user/util/userSignalDispatchUtil";
import EditRateLogUtil from "../user/util/editRateLogUtil";
import AgentBodyUtil from "../agent/util/agentBodyUtil";

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

                await UserSessionUtil.admit(socketUserContext);
                delete staleSocketFirstDetectedAt[user.id];

                for (const signalType of UserSignalDispatchUtil.signalTypes)
                {
                    socket.on(signalType, (buffer: ArrayBuffer) => {
                        void UserSignalDispatchUtil.dispatch(socketUserContext, signalType, buffer);
                    });
                }

                socket.on("disconnect", async () => {
                    console.log(`(SocketsServer) Client disconnected :: ${JSON.stringify(user)}`);
                    await UserSessionUtil.release(socketUserContext);
                });

                await UserSessionUtil.joinFirstRoom(socketUserContext);
            } catch (err) {
                console.error(`Exception while establishing a socket connection with a client :: Error: ${ErrorUtil.getErrorMessage(err)}`);
                socket.disconnect(true);
            }
        });

        // Signals are batched and flushed on an interval. Agents' bodies move first, so their moves go out with it.
        let lastFlushAt = Date.now();
        signalProcessingInterval = setInterval(() => {
            const now = Date.now();
            AgentBodyUtil.stepAll((now - lastFlushAt) / 1000);
            lastFlushAt = now;

            for (const userID in ServerUserManager.socketUserContexts)
            {
                ServerUserManager.socketUserContexts[userID].processAllPendingSignalsToUser();
            }
        }, SIGNAL_BATCH_SEND_INTERVAL);

        setInterval(async () => {
            // Clean up connections that ended without saying so (e.g. a browser crash, or an agent gone quiet).
            const currTime = Date.now();
            for (const [userID, ctx] of Object.entries(ServerUserManager.socketUserContexts))
            {
                if (!ctx.isConnected())
                {
                    if (staleSocketFirstDetectedAt[userID] == undefined)
                    {
                        staleSocketFirstDetectedAt[userID] = currTime;
                    }
                    else if (currTime - staleSocketFirstDetectedAt[userID] > 5000)
                    {
                        console.warn(`(SocketsServer) Stale connection detected, cleaning up :: userID = ${userID}`);
                        delete staleSocketFirstDetectedAt[userID];
                        await UserSessionUtil.release(ctx);
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
            EditRateLogUtil.flush(socketUserContext.user);
            socketUserContext.disconnect();
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

            // Set after the spread so client handshake values are overwritten. funnel is server-only
            // state, deliberately not part of User.
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
