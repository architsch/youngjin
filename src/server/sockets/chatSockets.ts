import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import DebugUtil from "../util/debugUtil";

let nsp: socketIO.Namespace;

const ChatSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/sockets_chat");
        nsp.use(authMiddleware);

        nsp.on("connection", socket => {
            console.log(`(ChatSockets) Client connected :: ${JSON.stringify(socket.handshake.auth.user)}`);

            /*socket.on("join", async (roomID) => {
                await socket.join(roomID);
            });
            socket.on("leave", async (roomID) => {
                await socket.leave(roomID);
            });
            socket.on("message", (data) => { // data = {name, room, message}
                DebugUtil.log("Chat Message Received", {data}, "low");
    
                const name = socket.data.name = data.name;
                const room = socket.data.room = data.room;
                const message = data.message;
    
                socket.join(room);
                nsp.to(room).emit("chat message", `<b>${name}:</b> ${message}`);
            });*/

            socket.on("disconnect", () => {
                console.log(`(ChatSockets) Client disconnected :: ${JSON.stringify(socket.handshake.auth.user)}`);
            });
        });
    },
};

export default ChatSockets;