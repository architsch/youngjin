import { io, Socket } from "socket.io-client";
import TextUtil from "../../shared/embeddedScripts/util/textUtil";
import MessageParams from "../../shared/types/networking/messageParams";
import User from "../../shared/types/db/user";
import ObjectSyncParams from "../../shared/types/networking/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/networking/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/networking/objectDespawnParams";
import WorldSyncParams from "../../shared/types/networking/worldSyncParams";
import World from "../gameplay/world";

let socket: Socket;

const worldSyncListeners: ((params: WorldSyncParams) => void)[] = [];
const objectSyncListeners: ((params: ObjectSyncParams) => void)[] = [];
const objectSpawnListeners: ((params: ObjectSpawnParams) => void)[] = [];
const objectDespawnListeners: ((params: ObjectDespawnParams) => void)[] = [];

const GameSocketsClient =
{
    init: () =>
    {
        //socket = io(`http://localhost:3000/game_sockets`);
        socket = io(`https://app.thingspool.net/game_sockets`); // TODO: Get the URL from an env variable.

        socket.on("connect_error", (err) => {
            $("#message_list").append($("<p>")
                .css("margin", "0 0")
                .css("padding", "2px 2px")
                .html(`<font color="red"><b>${err.message}</b></font>`));
        });

        socket.on("worldSync", (params: WorldSyncParams) => {
            console.log(`(GameSocketsClient) worldSync :: ${JSON.stringify(params)}`);
            new World(params);
        });

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

    addWorldSyncListener: (callback: (params: WorldSyncParams) => void) => { worldSyncListeners.push(callback); },
    addObjectSyncListener: (callback: (params: ObjectSyncParams) => void) => { objectSyncListeners.push(callback); },
    addObjectSpawnListener: (callback: (params: ObjectSpawnParams) => void) => { objectSpawnListeners.push(callback); },
    addObjectDespawnListener: (callback: (params: ObjectDespawnParams) => void) => { objectDespawnListeners.push(callback); },
}

export default GameSocketsClient;