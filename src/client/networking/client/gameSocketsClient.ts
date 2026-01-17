import { io, Socket } from "socket.io-client";
import ObjectMessageParams from "../../../shared/object/types/objectMessageParams";
import ObjectSyncParams from "../../../shared/object/types/objectSyncParams";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectDespawnParams from "../../../shared/object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../../shared/object/types/objectDesyncResolveParams";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import ThingsPoolEnv from "../../system/types/thingsPoolEnv";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableData from "../../../shared/networking/types/encodableData";
import RoomChangeRequestParams from "../../../shared/room/types/roomChangeRequestParams";
import { objectDespawnObservable, objectDesyncResolveObservable, objectMessageObservable, objectSpawnObservable, objectSyncObservable, roomRuntimeMemoryObservable, updateVoxelGridObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import BufferState from "../../../shared/networking/types/bufferState";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";

let socket: Socket;

const signalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
    "roomRuntimeMemory": (data: EncodableData) =>
        roomRuntimeMemoryObservable.set(data as RoomRuntimeMemory),
    "objectSyncParams": (data: EncodableData) => {
        const params = data as ObjectSyncParams;
        objectSyncObservable.set(params, params.objectId);
    },
    "objectDesyncResolveParams": (data: EncodableData) => {
        const params = data as ObjectDesyncResolveParams;
        objectDesyncResolveObservable.set(params, params.objectId);
    },
    "objectSpawnParams": (data: EncodableData) =>
        objectSpawnObservable.set(data as ObjectSpawnParams),
    "objectDespawnParams": (data: EncodableData) =>
        objectDespawnObservable.set(data as ObjectDespawnParams),
    "objectMessageParams": (data: EncodableData) => {
        const params = data as ObjectMessageParams;
        objectMessageObservable.set(params, params.senderObjectId);
    },
    "updateVoxelGridParams": (data: EncodableData) =>
        updateVoxelGridObservable.set(data as UpdateVoxelGridParams),
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
        });

        socket.on("signalBatch", (buffer: ArrayBuffer) => {
            //console.log(`signalBatch received - length = ${buffer.byteLength}`);
            const bufferState = new BufferState(new Uint8Array(buffer));
            while (bufferState.byteIndex < bufferState.view.byteLength)
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
    emitMoveVoxelBlock: (params: MoveVoxelBlockParams) =>
        sendEncodedSignal("updateVoxelGrid", new UpdateVoxelGridParams([params])),
    emitAddVoxelBlock: (params: AddVoxelBlockParams) =>
        sendEncodedSignal("updateVoxelGrid", new UpdateVoxelGridParams([params])),
    emitRemoveVoxelBlock: (params: RemoveVoxelBlockParams) =>
        sendEncodedSignal("updateVoxelGrid", new UpdateVoxelGridParams([params])),
    emitSetVoxelQuadTexture: (params: SetVoxelQuadTextureParams) =>
        sendEncodedSignal("updateVoxelGrid", new UpdateVoxelGridParams([params])),
    /*emitShrinkOrExpandVoxelBlock: (params: ShrinkOrExpandVoxelBlockParams) =>
        sendEncodedSignal("updateVoxelGrid", new UpdateVoxelGridParams([params])),*/
}

function sendEncodedSignal(signalType: string, signalData: EncodableData)
{
    const bufferState = EncodingUtil.startEncoding();
    signalData.encode(bufferState);
    const subBuffer = EncodingUtil.endEncoding(bufferState);
    socket.emit(signalType, subBuffer);
}

export default GameSocketsClient;