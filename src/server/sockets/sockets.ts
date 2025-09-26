import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./consoleSockets";
import GameSockets from "./gameSockets";
import dotenv from "dotenv";
import { SocketMiddleware } from "./types/socketMiddleware";
import User from "../../shared/types/db/user";
import AuthUtil from "../util/authUtil";
import * as cookie from "cookie";
dotenv.config();

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
            next(new Error("Authorization Failed (Cookie not found in the socket request header)"));
            return;
        }
        const cookieMap = cookie.parse(cookieStr);
        const token = cookieMap["thingspool_token"];
        if (!token)
        {
            next(new Error("Authorization Failed (Token not found in cookie string)"));
            return;
        }
        const user = AuthUtil.getUserFromToken(token);
        if (!user)
        {
            next(new Error("Authorization Failed (Cause: User not found in the token)"));
            return;
        }

        socket.handshake.auth = user;

        if (!passCondition(user))
        {
            next(new Error(`Authorization Failed (User "${user.userName}" does not satisfy the pass-condition)`));
            return;
        }
        next();
    }
}