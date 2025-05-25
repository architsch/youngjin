import http from "http";
import socketIO from "socket.io";
import consoleIO from "./consoleIO";
import chatIO from "./chatIO";
import dotenv from "dotenv";
dotenv.config();

export default function sockets(server: http.Server)
{
    const io = new socketIO.Server(server);
    io.listen(8080);

    consoleIO.init(io);
    chatIO.init(io);
}