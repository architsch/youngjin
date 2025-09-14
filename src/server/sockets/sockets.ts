import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./consoleSockets";
import ChatSockets from "./chatSockets";
import dotenv from "dotenv";
import { SocketMiddleware } from "./types/socketMiddleware";
dotenv.config();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server);

    ConsoleSockets.init(io,
        (process.env.MODE == "dev")
            ? (_, next) => next() // Don't authenticate in dev mode
            : makeAuthMiddleware((user: User) => user.userType == "admin")
    );
    
    ChatSockets.init(io,
        makeAuthMiddleware((user: User) => true)
    );
}

function makeAuthMiddleware(passCondition: (user: User) => Boolean): SocketMiddleware
{
    return (socket: socketIO.Socket, next: (err?: socketIO.ExtendedError) => void) =>
    {
        const user = socket.handshake.auth as User;
        console.log(user + " ::::: " + JSON.stringify(user));
        if (!passCondition(user))
        {
            next(new Error(`Authorization Failed (User "${user.userName}" does not satisfy the pass-condition)`));
            return;
        }
        next();
    }
}