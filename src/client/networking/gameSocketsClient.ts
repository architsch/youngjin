import { io, Socket } from "socket.io-client";
import TextUtil from "../../shared/embeddedScripts/util/textUtil";
import MessageParams from "../../shared/types/networking/messageParams";
import User from "../../shared/types/db/user";
import ObjectSyncParams from "../../shared/types/networking/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/networking/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/networking/objectDespawnParams";
import WorldSyncParams from "../../shared/types/networking/worldSyncParams";

let socket: Socket;

const objectSyncListeners: ((params: ObjectSyncParams) => void)[] = [];
const objectSpawnListeners: ((params: ObjectSpawnParams) => void)[] = [];
const objectDespawnListeners: ((params: ObjectDespawnParams) => void)[] = [];

const GameSocketsClient =
{
    init: (onWorldSync: (params: WorldSyncParams) => void) =>
    {
        socket = io(`${(window as any).thingspool_env.socket_server_url}/game_sockets`);

        socket.on("connect_error", (err) => {
            if (err.message.startsWith("http"))
            {
                (window as any).location.href = err.message;
            }
            else
            {
                (window as any).location.reload(true);
            }
        });

        socket.on("worldSync", onWorldSync);

        socket.on("objectSync", (params: ObjectSyncParams) => {
            //console.log(`(GameSocketsClient) objectSync :: ${JSON.stringify(params)}`);
            for (const listener of objectSyncListeners)
                listener(params);
        });
        socket.on("objectSpawn", (params: ObjectSpawnParams) => {
            console.log(`(GameSocketsClient) objectSpawn :: ${JSON.stringify(params)}`);
            for (const listener of objectSpawnListeners)
                listener(params);
        });
        socket.on("objectDespawn", (params: ObjectDespawnParams) => {
            console.log(`(GameSocketsClient) objectDespawn :: ${JSON.stringify(params)}`);
            for (const listener of objectDespawnListeners)
                listener(params);
        });

        socket.on("message", (params: MessageParams) => {
            const escapedMessage = TextUtil.escapeHTMLChars(params.message) as string;
            $("#message_list").prepend($("<p>")
                .css("margin", "0 0")
                .css("padding", "2px 2px")
                .html(`<font color="green"><b>${params.senderId}</b></font>: ${escapedMessage}`));
        });

        function send()
        {
            const message = ($("#message_input").val() as string).trim();
            const params: MessageParams = {
                senderId: (socket.auth as User).userName,
                message,
            };
            socket.emit("message", params);
            $("#message_input").val("");
        }
        $("#send_button").on("click", send);

        addEventListener("keydown", (event) => {
            if (event.key == "Enter")
            {
                event.preventDefault();
                if (($("#message_input").val() as string).trim().length > 0)
                    send();
            }
        });
    },

    emitObjectSync: (params: ObjectSyncParams) => { socket.emit("objectSync", params); },
    emitObjectSpawn: (params: ObjectSpawnParams) => { socket.emit("objectSpawn", params); },
    emitObjectDespawn: (params: ObjectDespawnParams) => { socket.emit("objectDespawn", params); },

    addObjectSyncListener: (callback: (params: ObjectSyncParams) => void) => { objectSyncListeners.push(callback); },
    addObjectSpawnListener: (callback: (params: ObjectSpawnParams) => void) => { objectSpawnListeners.push(callback); },
    addObjectDespawnListener: (callback: (params: ObjectDespawnParams) => void) => { objectDespawnListeners.push(callback); },
}

export default GameSocketsClient;