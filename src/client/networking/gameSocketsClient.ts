import { io, Socket } from "socket.io-client";
import ObjectMessageParams from "../../shared/types/gameplay/objectMessageParams";
import User from "../../shared/types/db/user";
import ObjectSyncParams from "../../shared/types/gameplay/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/gameplay/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/gameplay/objectDespawnParams";
import WorldSyncParams from "../../shared/types/gameplay/worldSyncParams";
import World from "../gameplay/world";
import TextUtil from "../../shared/embeddedScripts/util/textUtil"

let socket: Socket;

const objectSyncListeners: ((params: ObjectSyncParams) => void)[] = [];
const objectSpawnListeners: ((params: ObjectSpawnParams) => void)[] = [];
const objectDespawnListeners: ((params: ObjectDespawnParams) => void)[] = [];
const objectMessageListeners: ((params: ObjectMessageParams) => void)[] = [];

const GameSocketsClient =
{
    init: (onWorldSync: (params: WorldSyncParams) => void) =>
    {
        const env = (window as any).thingspool_env;
        const user = JSON.parse(env.userString) as User;

        socket = io(`${env.socket_server_url}/game_sockets`);

        socket.on("connect_error", (err) => {
            if (err.message.startsWith("http"))
                (window as any).location.href = err.message;
            else if (env.mode == "dev")
                (window as any).location.reload(true);
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
        socket.on("objectMessage", (params: ObjectMessageParams) => {
            console.log(`(GameSocketsClient) objectMessage :: ${JSON.stringify(params)}`);
            for (const listener of objectMessageListeners)
                listener(params);
        });

        // temp UI

        const uiRoot = document.getElementById("uiRoot") as HTMLElement;

        const messageInput = document.createElement("input");
        messageInput.type = "text";
        messageInput.placeholder = "Your Message Here";
        messageInput.style = "pointer-events:all; position:absolute; margin:0.25rem 0.25rem; padding:0.25rem 0.25rem; left:0; right:20%; bottom:0; height:1.5rem; text-size:1rem; line-height:1.5rem;";
        uiRoot.appendChild(messageInput);

        const sendButton = document.createElement("button");
        sendButton.innerHTML = "Send";
        sendButton.style = "pointer-events:all; position:absolute; margin:0.25rem 0.25rem; padding:0.25rem 0.25rem; left:80%; right:0%; bottom:0; height:1.5rem; text-size:1rem; line-height:1.5rem; background-color:green; color:white;"
        sendButton.onclick = (ev: PointerEvent) => {
            send();
        };
        uiRoot.appendChild(sendButton);

        const myMessageDisplay = document.createElement("div");
        myMessageDisplay.style = "position:absolute; left:0.25rem; margin:0 0; padding:0.25rem 0.25rem; bottom:2.8rem; height:1.5rem; text-size:1rem; line-height:1.5rem; background-color:rgba(0, 0, 0, 0.5); color:yellow;";
        myMessageDisplay.style.display = "none";
        uiRoot.appendChild(myMessageDisplay);

        let myMessageTimeout: NodeJS.Timeout | undefined;

        function send()
        {
            const message = messageInput.value.trim();
            if (message.length > 0)
            {
                const player = World.currentInstance.getPlayer(user.userName);
                if (!player)
                {
                    console.error(`Player not found (userName = ${user.userName})`);
                    return;
                }
                const params: ObjectMessageParams = {
                    senderObjectId: player.objectId,
                    message,
                };
                GameSocketsClient.emitObjectMessage(params);
                messageInput.value = "";

                myMessageDisplay.innerHTML = "<font color='green'><b>My Message:</b></font> " + TextUtil.escapeHTMLChars(params.message);
                myMessageDisplay.style.display = "block";
                if (myMessageTimeout)
                    clearTimeout(myMessageTimeout);
                myMessageTimeout = setTimeout(() => {
                    myMessageDisplay.innerHTML = "";
                    myMessageDisplay.style.display = "none";
                }, 5000);
            }
        }
        addEventListener("keydown", (ev: KeyboardEvent) => {
            if (ev.key == "Enter")
            {
                ev.preventDefault();
                send();
            }
        });
    },

    emitObjectSync: (params: ObjectSyncParams) => { socket.emit("objectSync", params); },
    emitObjectSpawn: (params: ObjectSpawnParams) => { socket.emit("objectSpawn", params); },
    emitObjectDespawn: (params: ObjectDespawnParams) => { socket.emit("objectDespawn", params); },
    emitObjectMessage: (params: ObjectMessageParams) => { socket.emit("objectMessage", params); },

    addObjectSyncListener: (callback: (params: ObjectSyncParams) => void) => { objectSyncListeners.push(callback); },
    addObjectSpawnListener: (callback: (params: ObjectSpawnParams) => void) => { objectSpawnListeners.push(callback); },
    addObjectDespawnListener: (callback: (params: ObjectDespawnParams) => void) => { objectDespawnListeners.push(callback); },
    addObjectMessageListener: (callback: (params: ObjectMessageParams) => void) => { objectMessageListeners.push(callback); },
}

export default GameSocketsClient;