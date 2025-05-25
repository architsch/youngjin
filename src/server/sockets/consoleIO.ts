import dependencyInjector from "../dependencyInjector";
import socketIO from "socket.io";
import debugUtil from "../util/debugUtil";

let nsp: socketIO.Namespace;

const col1 = `<td style="color: #e0e020; background-color: #202090;">`;
const col2 = `<td style="color: #20e020; background-color: #101010;">`;
const col3 = `<td style="color: #303030; background-color: #c0c0c0;">`;
const end = `</td>`;
const row = (txt1: string, txt2: string, txt3: string) =>
    `${col1}${txt1}${end}${col2}${txt2}${end}${col3}${txt3}${end}`;

const consoleIO =
{
    init: (io: socketIO.Server): void =>
    {
        nsp = io.of("/console").on("connection", (socket: socketIO.Socket) => {
            console.log("(consoleIO) Client connected");

            socket.on("command", (command) => {
                console.log(`(consoleIO) Command received: [${command}]`);
                const words = command.split(" ");
                switch (words[0])
                {
                    case "test":
                        words.shift();
                        if (words.length == 0)
                            debugUtil.logRaw("Please provide the name of the test.", "high", "pink");
                        else
                            dependencyInjector.test(words[0], (words.length == 1) ? "low" : words[1]);
                        break;
                    case "print":
                        words.shift();
                        nsp.emit("log", row((words.length == 0) ? "-" : words.join(" "), "-", "-"));
                        break;
                    case "reboot":
                        nsp.emit("log", row("Rebooting...", "-", "-"));
                        process.exit(0);
                        break;
                    default:
                        nsp.emit("log", row("ERROR: Unknown Command", "-", "-"));
                        break;
                }
            });

            socket.on("disconnect", () => {
                console.log("(consoleIO) Client disconnected");
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

export default consoleIO;