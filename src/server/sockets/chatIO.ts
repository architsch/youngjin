import authUtil from "../util/authUtil";
import debugUtil from "../util/debugUtil";
import socketIO from "socket.io";
import { Request } from "express";

//let nsp: socketIO.Namespace;

const chatIO =
{
    init: (io: socketIO.Server) =>
    {
        const nsp = io.of("/chat");

        nsp.use(async (socket: socketIO.Socket,
            next: (err?: socketIO.ExtendedError) => void): Promise<void> =>
        {
            const req = socket.request as Request;
            const res = req.res;
            const success = await authUtil.authenticateToken_internal(next, false, req, res);
            if (!success)
                debugUtil.logRaw("Socket Auth Failure", "high", "pink");
        });

        nsp.on("connection", socket => {
            socket.on("join chat", async (roomID) => {
                await socket.join(roomID);
            });
            socket.on("leave chat", async (roomID) => {
                await socket.leave(roomID);
            });
            socket.on("chat message", (data) => { // data = {name, room, message}
                debugUtil.log("Chat Message Received", {data}, "low");
    
                const name = socket.data.name = data.name;
                const room = socket.data.room = data.room;
                const message = data.message;
    
                socket.join(room);
                nsp.to(room).emit("chat message", `<b>${name}:</b> ${message}`);
            });
        });


        /*nsp = io.of("/chat").on("connection", (socket: socketIO.Socket) => {
            debugUtil.log("Chat Client Connected", {socket}, "medium");
    
            socket.on("chat message", (data) => { // data = {name, room, message}
                debugUtil.log("Chat Message Received", {data}, "low");
    
                const name = socket.name = data.name;
                const room = socket.room = data.room;
                const message = data.message;
    
                socket.join(room);
                chatIO.to(room).emit("chat message", `<b>${name}:</b> ${message}`);
            });
    
            socket.on("disconnect", () => {
                debugUtil.log("Chat Client Disconnected", {socket}, "medium");
            });
        });*/
    },
};

export default chatIO;