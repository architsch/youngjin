import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./ConsoleSockets";
import ChatSockets from "./ChatSockets";
import dotenv from "dotenv";
dotenv.config();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server);
    io.listen(8080);

    ConsoleSockets.init(io);
    ChatSockets.init(io);
}