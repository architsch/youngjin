import { io, Socket } from "socket.io-client";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ThingsPoolEnv from "../system/types/thingsPoolEnv";
import Encoding from "../../shared/networking/encoding";
import EncodableArray from "../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../shared/networking/types/encodableRawByteNumber";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import EncodableData from "../../shared/networking/types/encodableData";
import RoomChangeRequestParams from "../../shared/room/types/roomChangeRequestParams";
import { objectDespawnObservable, objectDesyncResolveObservable, objectMessageObservable, objectSpawnObservable, objectSyncObservable, roomRuntimeMemoryObservable } from "../system/observables";
import { tryStartClientProcess } from "../system/types/clientProcess";

let socket: Socket;

const signalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
    "roomRuntimeMemory": (data: EncodableData) => roomRuntimeMemoryObservable.set(data as RoomRuntimeMemory),
    "objectSyncParams": (data: EncodableData) => objectSyncObservable.set(data as ObjectSyncParams),
    "objectDesyncResolveParams": (data: EncodableData) => objectDesyncResolveObservable.set(data as ObjectDesyncResolveParams),
    "objectSpawnParams": (data: EncodableData) => objectSpawnObservable.set(data as ObjectSpawnParams),
    "objectDespawnParams": (data: EncodableData) => objectDespawnObservable.set(data as ObjectDespawnParams),
    "objectMessageParams": (data: EncodableData) => objectMessageObservable.set(data as ObjectMessageParams),
}

const GameSocketsClient =
{
    init: (env: ThingsPoolEnv) =>
    {
        if (!tryStartClientProcess("roomChange", 1, 0))
            throw new Error("'roomChange' process is already ongoing.");

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
    },

    emitObjectSync: (params: ObjectSyncParams) => sendEncodedSignal("objectSync", params),
    emitObjectMessage: (params: ObjectMessageParams) => sendEncodedSignal("objectMessage", params),
    tryEmitRoomChangeRequest: (params: RoomChangeRequestParams) => {
        if (tryStartClientProcess("roomChange", 1, 1))
            sendEncodedSignal("roomChangeRequest", params);
        else
            console.warn("Cannot change room because 'roomChange' process is ongoing.");
    },
}

function sendEncodedSignal(signalType: string, signalData: EncodableData)
{
    const bufferState = Encoding.startWrite();
    signalData.encode(bufferState);
    const subBuffer = Encoding.endWrite(bufferState);
    socket.emit(signalType, subBuffer);
}

export default GameSocketsClient;