import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./consoleSockets";
import GameSockets from "./gameSockets";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/user/types/user";
import AddressUtil from "../networking/util/addressUtil";
import * as cookie from "cookie";
import { UserTypeEnumMap } from "../../shared/user/types/userType";
import UserTokenUtil from "../user/util/userTokenUtil";
import CookieUtil from "../networking/util/cookieUtil";

const connectedUserNames = new Set<string>();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server, {
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

    ConsoleSockets.init(io,
        (process.env.MODE == "dev")
            ? (_, next) => next() // Don't authenticate in dev mode
            : makeAuthMiddleware((user: User) => user.userType == UserTypeEnumMap.Admin)
    );
    
    GameSockets.init(io,
        makeAuthMiddleware((user: User) => true)
    );
}

function makeAuthMiddleware(passCondition: (user: User) => Boolean): SocketMiddleware
{
    return (socket: socketIO.Socket, next: (err?: socketIO.ExtendedError) => void) =>
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
        const user = UserTokenUtil.getUserFromToken(token);
        if (!user)
        {
            next(new Error(AddressUtil.getErrorPageURL("auth-failure")));
            return;
        }

        if (connectedUserNames.has(user.userName))
        {
            next(new Error(AddressUtil.getErrorPageURL("auth-duplication")));
            return;
        }

        if (!passCondition(user))
        {
            next(new Error(AddressUtil.getErrorPageURL("auth-no-permission")));
            return;
        }

        connectedUserNames.add(user.userName);

        socket.on("disconnect", () => {
            if (!connectedUserNames.has(user.userName))
            {
                console.error(`User "${user.userName}" is already disconnected.`);
                return;
            }
            connectedUserNames.delete(user.userName);
        });

        socket.handshake.auth = user;
        next();
    }
}