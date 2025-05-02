const debugUtil = require("../util/debugUtil");

let handle;

const chatIO =
{
    init: (io) =>
    {
        handle = io.of("/chat").on("connection", (socket) => {
            debugUtil.log("Chat Client Connected", {socket});
    
            socket.on("chat message", (data) => { // data = {name, room, message}
                debugUtil.log("Chat Message Received", {data});
    
                const name = socket.name = data.name;
                const room = socket.room = data.room;
                const message = data.message;
    
                socket.join(room);
                chatIO.to(room).emit("chat message", `<b>${name}:</b> ${message}`);
            });
    
            socket.on("disconnect", () => {
                debugUtil.log("Chat Client Disconnected", {socket});
            });
        });
    },
};

module.exports = chatIO;