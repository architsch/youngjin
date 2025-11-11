import { io, Socket } from "socket.io-client";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import TextUtil from "../../shared/embeddedScripts/util/textUtil"
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ThingsPoolEnv from "./thingsPoolEnv";
import Observable from "../util/observable";
import ObjectManager from "../object/objectManager";
import Encoding from "../../shared/networking/encoding";
import EncodableArray from "../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../shared/networking/types/encodableRawByteNumber";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import EncodableData from "../../shared/networking/types/encodableData";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";

let socket: Socket;

const signalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
    "roomRuntimeMemory": (data: EncodableData) => GameSocketsClient.roomRuntimeMemoryObservable.broadcast(data as RoomRuntimeMemory),
    "objectSyncParams": (data: EncodableData) => GameSocketsClient.objectSyncObservable.broadcast(data as ObjectSyncParams),
    "objectDesyncResolveParams": (data: EncodableData) => GameSocketsClient.objectDesyncResolveObservable.broadcast(data as ObjectDesyncResolveParams),
    "objectSpawnParams": (data: EncodableData) => GameSocketsClient.objectSpawnObservable.broadcast(data as ObjectSpawnParams),
    "objectDespawnParams": (data: EncodableData) => GameSocketsClient.objectDespawnObservable.broadcast(data as ObjectDespawnParams),
    "objectMessageParams": (data: EncodableData) => GameSocketsClient.objectMessageObservable.broadcast(data as ObjectMessageParams),
}

const GameSocketsClient =
{
    init: (env: ThingsPoolEnv) =>
    {
        socket = io(`${env.socket_server_url}/game_sockets`);

        socket.on("connect_error", (err) => {
            console.error(`SocketIO connection error :: ${err}`);
            if (err.message.startsWith("http"))
                (window as any).location.href = err.message;
            else if (env.mode == "dev")
                (window as any).location.reload(true);
        });

        socket.on("signalBatch", (buffer: ArrayBuffer) => {
            //console.log(`signalBatch received - length = ${buffer.byteLength}`);
            const bufferState = { view: new Uint8Array(buffer), index: 0 };
            while (bufferState.index < bufferState.view.byteLength)
            {
                const signalTypeIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
                const signalConfig = SignalTypeConfigMap.getConfigByIndex(signalTypeIndex);
                if (!signalConfig)
                {
                    console.error(`Unknown signal type index: ${signalTypeIndex}`);
                    return;
                }
                const signalHandler = signalHandlers[signalConfig.signalType];
                if (!signalHandler)
                {
                    console.error(`Signal handler not found (signal type = ${signalConfig.signalType})`);
                    return;
                }
                const arr = (EncodableArray.decodeWithParams(bufferState, signalConfig.decode, 65535) as EncodableArray).arr;
                for (const data of arr)
                    signalHandler(data);
            }
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
                const params = new ObjectMessageParams(
                    player.params.objectId,
                    message
                );
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

    emitObjectSync: (params: ObjectSyncParams) => sendEncodedSignal("objectSync", params),
    emitObjectMessage: (params: ObjectMessageParams) => sendEncodedSignal("objectMessage", params),
    emitRoomChangeRequest: (params: RoomChangeRequestParams) => sendEncodedSignal("roomChangeRequest", params),

    roomRuntimeMemoryObservable: new Observable<RoomRuntimeMemory>(),
    objectSyncObservable: new Observable<ObjectSyncParams>(),
    objectDesyncResolveObservable: new Observable<ObjectDesyncResolveParams>(),
    objectSpawnObservable: new Observable<ObjectSpawnParams>(),
    objectDespawnObservable: new Observable<ObjectDespawnParams>(),
    objectMessageObservable: new Observable<ObjectMessageParams>(),
}

function sendEncodedSignal(signalType: string, signalData: EncodableData)
{
    const bufferState = Encoding.startWrite();
    signalData.encode(bufferState);
    const subBuffer = Encoding.endWrite(bufferState);
    socket.emit(signalType, subBuffer);
}

export default GameSocketsClient;