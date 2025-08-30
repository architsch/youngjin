import http from "http";
import socketIO from "socket.io";
import * as cookie from "cookie";
import AuthUtil from "../util/authUtil";
import ConsoleSockets from "./consoleSockets";
import ChatSockets from "./chatSockets";
import dotenv from "dotenv";
import { SocketMiddleware } from "./types/socketMiddleware";
dotenv.config();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server);

    ConsoleSockets.init(io,
        makeAuthMiddleware((user: User) => user.userType == "admin")
    );
    
    ChatSockets.init(io,
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
            next(new Error("Authorization Failed (Token not found in cookieStr)"));
            return;
        }
        const user = AuthUtil.getUserFromToken(token);
        if (!user)
        {
            next(new Error("Authorization Failed (Cause: User not found in the token)"));
            return;
        }
        if (!passCondition(user))
        {
            next(new Error(`Authorization Failed (User "${user.userName}" does not satisfy the pass-condition)`));
            return;
        }
        socket.handshake.auth.user = user;
        next();
    }
}