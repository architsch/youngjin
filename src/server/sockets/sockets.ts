import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./consoleSockets";
import GameSockets from "./gameSockets";
import dotenv from "dotenv";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/types/db/user";
import AuthUtil from "../util/authUtil";
import NetworkUtil from "../util/networkUtil";
import * as cookie from "cookie";
dotenv.config();

const connectedUserNames = new Set<string>();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server);

    ConsoleSockets.init(io,
        (process.env.MODE == "dev")
            ? (_, next) => next() // Don't authenticate in dev mode
            : makeAuthMiddleware((user: User) => user.userType == "admin")
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
            next(new Error(NetworkUtil.getErrorPageURL("auth-failure")));
            return;
        }
        const cookieMap = cookie.parse(cookieStr);
        const token = cookieMap["thingspool_token"];
        if (!token)
        {
            next(new Error(NetworkUtil.getErrorPageURL("auth-failure")));
            return;
        }
        const user = AuthUtil.getUserFromToken(token);
        if (!user)
        {
            next(new Error(NetworkUtil.getErrorPageURL("auth-failure")));
            return;
        }

        if (connectedUserNames.has(user.userName))
        {
            next(new Error(NetworkUtil.getErrorPageURL("auth-duplication")));
            return;
        }

        if (!passCondition(user))
        {
            next(new Error(NetworkUtil.getErrorPageURL("auth-no-permission")));
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