const envUtil = require("../util/envUtil.js");

const dev = envUtil.isDevMode();
let handle;

const consoleIO =
{
    init: (io) =>
    {
        handle = io.of("/console").on("connection", (socket) => {
            console.log("(consoleIO) Client connected");

            socket.on("command", (command) => {
                console.log(`(consoleIO) Command received: [${command}]`);
                const words = command.split(" ");
                switch (words[0])
                {
                    case "test":
                        words.shift();
                        const testname = (words.length == 0) ? "default" : words[0];
                        require("../../test/test")(testname);
                        break;
                    case "print":
                        words.shift();
                        handle.emit("log", `<td class="col col1" style="color:black; background-color:yellow;">${(words.length == 0) ? "-" : words.join(" ")}</td><td class="col col2" style="color:black; background-color:yellow;"></td><td class="col col3" style="color:black; background-color:yellow;"></td>`);
                        break;
                    case "reboot":
                        handle.emit("log", `<td class="col col1" style="color:black; background-color:#ffffff;">Rebooting...</td><td class="col col2" style="color:black; background-color:#ffffff;"></td><td class="col col3" style="color:black; background-color:#ffffff;"></td>`);
                        process.exit(0);
                        break;
                    default:
                        handle.emit("log", `<td class="col col1" style="background-color:#900000;">ERROR: Unknown Command</td><td class="col col2" style="background-color:#900000;"></td><td class="col col3" style="background-color:#900000;"></td>`);
                        break;
                }
            });

            socket.on("disconnect", () => {
                console.log("(consoleIO) Client disconnected");
            });
        });
    },
    log: (message, origin, details) =>
    {
        if (dev)
            console.log(`(CONSOLE) --- ${message} --- ${origin} --- ${details}`);
        handle.emit("log", `<td class="col col1">${message}</td><td class="col col2">${origin}</td><td class="col col3">${details}</td>`);
    },
};

module.exports = consoleIO;