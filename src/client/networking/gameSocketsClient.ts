import { io, Socket } from "socket.io-client";
import ObjectMessageParams from "../../shared/object/objectMessageParams";
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import ObjectDesyncResolveParams from "../../shared/object/objectDesyncResolveParams";
import TextUtil from "../../shared/embeddedScripts/util/textUtil"
import RoomRuntimeMemory from "../../shared/room/roomRuntimeMemory";
import ThingsPoolEnv from "./thingsPoolEnv";
import Observable from "../util/observable";
import ObjectManager from "../object/objectManager";

let socket: Socket;

const GameSocketsClient =
{
    init: (env: ThingsPoolEnv) =>
    {
        socket = io(`${env.socket_server_url}/game_sockets`);

        socket.on("connect_error", (err) => {
            if (err.message.startsWith("http"))
                (window as any).location.href = err.message;
            else if (env.mode == "dev")
                (window as any).location.reload(true);
        });

        socket.on("changeRoom", (roomRuntimeMemory: RoomRuntimeMemory) => {
            GameSocketsClient.changeRoomObservable.broadcast(roomRuntimeMemory);
        });
        socket.on("objectSync", (arr: ObjectSyncParams[]) => {
            for (let i = 0; i < arr.length; ++i)
                GameSocketsClient.objectSyncObservable.broadcast(arr[i]);
        });
        socket.on("objectDesyncResolve", (arr: ObjectDesyncResolveParams[]) => {
            for (let i = 0; i < arr.length; ++i)
                GameSocketsClient.objectDesyncResolveObservable.broadcast(arr[i]);
        });
        socket.on("objectSpawn", (arr: ObjectSpawnParams[]) => {
            for (let i = 0; i < arr.length; ++i)
                GameSocketsClient.objectSpawnObservable.broadcast(arr[i]);
        });
        socket.on("objectDespawn", (arr: ObjectDespawnParams[]) => {
            for (let i = 0; i < arr.length; ++i)
                GameSocketsClient.objectDespawnObservable.broadcast(arr[i]);
        });
        socket.on("objectMessage", (arr: ObjectMessageParams[]) => {
            for (let i = 0; i < arr.length; ++i)
                GameSocketsClient.objectMessageObservable.broadcast(arr[i]);
        });

        // temp UI

        const uiRoot = document.getElementById("uiRoot") as HTMLElement;

        const messageInput = document.createElement("input");
        messageInput.type = "text";
        messageInput.placeholder = "Your Message Here";
        messageInput.style = "pointer-events:all; position:absolute; margin:0.25rem 0.25rem; padding:0.25rem 0.25rem; left:0; right:20%; bottom:0; height:1.5rem; text-size:1rem; line-height:1.5rem;";
        messageInput.oninput = (ev: Event) => {
            messageInput.value = messageInput.value.substring(0, 32);
        };
        uiRoot.appendChild(messageInput);

        const sendButton = document.createElement("button");
        sendButton.innerHTML = "Send";
        sendButton.style = "pointer-events:all; position:absolute; margin:0.25rem 0.25rem; padding:0.25rem 0.25rem; left:80%; right:0%; bottom:0; height:2.25rem; text-size:1rem; line-height:1.5rem; background-color:green; color:white;"
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
            const message = messageInput.value.trim().substring(0, 32);
            if (message.length > 0)
            {
                const player = ObjectManager.getMyPlayer();
                if (!player)
                {
                    console.error(`Player not found (userName = ${env.user.userName})`);
                    return;
                }
                const params: ObjectMessageParams = {
                    senderObjectId: player.params.objectId,
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

    emitObjectSync: (params: ObjectSyncParams) => socket.emit("objectSync", params),
    emitObjectSpawn: (params: ObjectSpawnParams) => socket.emit("objectSpawn", params),
    emitObjectDespawn: (params: ObjectDespawnParams) => socket.emit("objectDespawn", params),
    emitObjectMessage: (params: ObjectMessageParams) => socket.emit("objectMessage", params),

    changeRoomObservable: new Observable<RoomRuntimeMemory>(),
    objectSyncObservable: new Observable<ObjectSyncParams>(),
    objectDesyncResolveObservable: new Observable<ObjectDesyncResolveParams>(),
    objectSpawnObservable: new Observable<ObjectSpawnParams>(),
    objectDespawnObservable: new Observable<ObjectDespawnParams>(),
    objectMessageObservable: new Observable<ObjectMessageParams>(),
}

export default GameSocketsClient;