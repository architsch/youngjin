import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import LogUtil from "../../shared/system/util/logUtil";
import { logEventObservable } from "../../shared/system/sharedObservables";
import LogEvent from "../../shared/system/types/logEvent";

let nsp: socketIO.Namespace;

const col1 = `<td style="color: #e0e020; background-color: #202090;">`;
const col2 = `<td style="color: #303030; background-color: #c0c0c0;">`;
const end = `</td>`;
const row = (txt1: string, txt2: string) =>
    `${col1}${txt1}${end}${col2}${txt2}${end}`;

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
                        LogUtil.logRaw((words.length == 0) ? "-" : words.join(" "), "high");
                        break;
                    case "reboot":
                        LogUtil.logRaw("Rebooting...", "high");
                        process.exit(0);
                        break;
                    default:
                        LogUtil.logRaw(`Unknown command "${words[0]}".`, "high", "error");
                        break;
                }
            });

            socket.on("disconnect", () => {
                console.log(`(ConsoleSockets) Client disconnected :: ${JSON.stringify(socket.handshake.auth)}`);
                logEventObservable.removeListener(`consoleSocket_${socket.id}`);
            });

            logEventObservable.addListener(`consoleSocket_${socket.id}`, ConsoleSockets.log);
        });
    },
    log: (logEvent: LogEvent): void =>
    {
        let title = logEvent.eventTitle;
        switch (logEvent.logType)
        {
            case "info": break;
            case "warn": title = `<b style="color:yellow">${title}</b>`; break;
            case "error": title = `<b style="color:pink">${title}</b>`; break;
            default: throw new Error(`Unknown log type: ${logEvent.logType}`);
        }
        nsp?.emit("log", row(title, logEvent.eventDescJSON));
    },
};

export default ConsoleSockets;