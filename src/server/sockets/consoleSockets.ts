import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ServerLogUtil from "../networking/util/serverLogUtil";

let nsp: socketIO.Namespace;

const col1 = `<td style="color: #e0e020; background-color: #202090;">`;
const col2 = `<td style="color: #20e020; background-color: #101010;">`;
const col3 = `<td style="color: #303030; background-color: #c0c0c0;">`;
const end = `</td>`;
const row = (txt1: string, txt2: string, txt3: string) =>
    `${col1}${txt1}${end}${col2}${txt2}${end}${col3}${txt3}${end}`;

const ConsoleSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/console_sockets");
        nsp.use(authMiddleware);
    
        nsp.on("connection", (socket: socketIO.Socket) => {
            console.log(`(ConsoleSockets) Client connected :: ${JSON.stringify(socket.handshake.auth)}`);

            socket.on("command", (command) => {
                console.log(`(ConsoleSockets) Command received :: [${command}] - sent by :: ${JSON.stringify(socket.handshake.auth.user)}`);
                const words = command.split(" ");
                switch (words[0])
                {
                    case "print":
                        words.shift();
                        ServerLogUtil.logRaw((words.length == 0) ? "-" : words.join(" "), "high");
                        break;
                    case "reboot":
                        ServerLogUtil.logRaw("Rebooting...", "high");
                        process.exit(0);
                        break;
                    default:
                        ServerLogUtil.logRaw(`Unknown command "${words[0]}".`, "high", "pink");
                        break;
                }
            });

            socket.on("disconnect", () => {
                console.log(`(ConsoleSockets) Client disconnected :: ${JSON.stringify(socket.handshake.auth)}`);
            });
        });
    },
    log: (message: string, origin: string, details: string): void =>
    {
        if (nsp)
            nsp.emit("log", row(message, origin, details));
        else
            console.log(`${message} (ORIGIN: ${origin}) (DETAILS: ${details})`);
    },
};

export default ConsoleSockets;