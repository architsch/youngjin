import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import DebugUtil from "../util/debugUtil";

let nsp: socketIO.Namespace;

const ChatSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/chat_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", (socket: socketIO.Socket) => {
            console.log(`(ChatSockets) Client connected :: ${JSON.stringify(socket.handshake.auth)}`);

            socket.on("message", (message: string) => {
                DebugUtil.log("Chat Message Received", {message}, "low");
                nsp.to("room_default").emit("message", message);
            });

            socket.on("object_sync", (id: number, x: number, y: number, angleY: number) => {
                DebugUtil.log("Object Sync Received", {x, y, angleY}, "low");
                nsp.to("room_default").emit("object_sync", id, x, y, angleY);
            });

            socket.on("disconnect", () => {
                console.log(`(ChatSockets) Client disconnected :: ${JSON.stringify(socket.handshake.auth)}`);
            });

            socket.join("room_default");
        });
    },
};

export default ChatSockets;