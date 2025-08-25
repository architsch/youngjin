import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import DebugUtil from "../util/debugUtil";
import EnvUtil from "../util/envUtil"
import DB from "../db/db";
import ServiceLocatorUtil from "../util/serviceLocatorUtil";

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
        nsp = io.of("/sockets_console");
        nsp.use(authMiddleware);
    
        nsp.on("connection", (socket: socketIO.Socket) => {
            console.log(`(ConsoleSockets) Client connected :: ${JSON.stringify(socket.handshake.auth.user)}`);

            socket.on("command", (command) => {
                console.log(`(ConsoleSockets) Command received :: [${command}] - sent by :: ${JSON.stringify(socket.handshake.auth.user)}`);
                const words = command.split(" ");
                switch (words[0])
                {
                    case "test":
                        words.shift();
                        if (words.length == 0)
                            DebugUtil.logRaw("Please provide the name of the test.", "high", "pink");
                        else
                            ServiceLocatorUtil.get("test")(words[0], (words.length == 1) ? "low" : words[1]);
                        break;
                    case "print":
                        words.shift();
                        DebugUtil.logRaw((words.length == 0) ? "-" : words.join(" "), "high");
                        break;
                    case "db":
                        if (EnvUtil.isDevMode())
                        {
                            words.shift();
                            DB.runSQLFile(`${words[0]}.sql`);
                        }
                        else
                            DebugUtil.logRaw(`Command "${words[0]}" is supported only in dev mode.`, "high", "pink");
                        break;
                    case "reboot":
                        DebugUtil.logRaw("Rebooting...", "high");
                        process.exit(0);
                        break;
                    default:
                        DebugUtil.logRaw(`Unknown command "${words[0]}".`, "high", "pink");
                        break;
                }
            });

            socket.on("disconnect", () => {
                console.log(`(ConsoleSockets) Client disconnected :: ${JSON.stringify(socket.handshake.auth.user)}`);
            });
        });
    },
    log: (message: string, origin: string, details: string): void =>
    {
        if (nsp)
            nsp.emit("log", row(message, origin, details));
        else
            console.log(`${message}\n(ORIGIN: ${origin})\n(DETAILS: ${details})`);
    },
};

export default ConsoleSockets;