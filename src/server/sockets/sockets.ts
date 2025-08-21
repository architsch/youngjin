import http from "http";
import socketIO from "socket.io";
import ConsoleSockets from "./consoleSockets";
import ChatSockets from "./chatSockets";
import dotenv from "dotenv";
dotenv.config();

export default function Sockets(server: http.Server)
{
    const io = new socketIO.Server(server);
    io.listen(8080);

    ConsoleSockets.init(io);
    ChatSockets.init(io);
}