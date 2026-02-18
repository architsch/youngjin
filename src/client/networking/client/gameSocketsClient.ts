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
import { connectionStateObservable, objectDespawnObservable, objectDesyncResolveObservable, objectMessageObservable, objectSpawnObservable, objectSyncObservable, roomRuntimeMemoryObservable, updateVoxelGridObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import BufferState from "../../../shared/networking/types/bufferState";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import UserCommandParams from "../../../shared/user/types/userCommandParams";

let socket: Socket;

const incomingSignalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
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

const lastSignalSentTimes: {[signalType: string]: number} = {};

const GameSocketsClient =
{
    init: (env: ThingsPoolEnv) =>
    {
        if (!tryStartClientProcess("roomChange", 1, 0))
            throw new Error("'roomChange' process is already ongoing.");

        const connectionURL = `${env.socket_server_url}/game_sockets`;
        console.log(`Attempting to establish a socket connection with: [${connectionURL}]`);
        socket = io(connectionURL, {
            transports: ["websocket", "polling"],
            upgrade: true,
            reconnectionAttempts: 30,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        let hasConnectedBefore = false;

        socket.on("connect", () => {
            console.log(`Successfully connected to game_sockets (transport: ${socket.io.engine.transport.name})`);
            connectionStateObservable.set("connected");
            if (hasConnectedBefore)
            {
                // Reconnection: start a new roomChange process so the server's
                // auto-join flow (which sends roomRuntimeMemory) can complete.
                tryStartClientProcess("roomChange", 1, 0);
            }
            hasConnectedBefore = true;
        });

        socket.on("disconnect", (reason) => {
            console.warn(`Socket disconnected (reason: ${reason})`);
            connectionStateObservable.set("reconnecting");
        });

        socket.on("connect_error", (err) => {
            console.error("SocketIO connection error");
            console.error(`Error message: ${err.message}`);
            console.error(`Error data:`, err);
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
                const incomingSignalHandler = incomingSignalHandlers[signalConfig.signalType];
                if (!incomingSignalHandler)
                {
                    console.error(`Incoming Signal handler not found (signal type = ${signalConfig.signalType})`);
                    return;
                }
                const arr = (EncodableArray.decodeWithParams(bufferState, signalConfig.decode, 65535) as EncodableArray).arr;
                for (const data of arr)
                    incomingSignalHandler(data);
            }
        });
    },

    emitObjectSync: (params: ObjectSyncParams) => emitWhenReady("objectSyncParams", params),
    emitObjectMessage: (params: ObjectMessageParams) => emitWhenReady("objectMessageParams", params),
    emitUserCommand: (params: UserCommandParams) => emitWhenReady("userCommandParams", params),
    tryEmitRoomChangeRequest: (params: RoomChangeRequestParams) => {
        if (tryStartClientProcess("roomChange", 1, 1))
            emitWhenReady("roomChangeRequestParams", params);
        else
            console.warn("Cannot change room because 'roomChange' process is ongoing.");
    },
    emitMoveVoxelBlock: (params: MoveVoxelBlockParams) =>
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams([params])),
    emitAddVoxelBlock: (params: AddVoxelBlockParams) =>
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams([params])),
    emitRemoveVoxelBlock: (params: RemoveVoxelBlockParams) =>
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams([params])),
    emitSetVoxelQuadTexture: (params: SetVoxelQuadTextureParams) =>
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams([params])),
}

function emitWhenReady(signalType: string, signalData: EncodableData,
    maxRetries: number = 10, retryInterval: number = 200)
{
    const throttleInterval = SignalTypeConfigMap.getConfigByType(signalType).throttleInterval;
    if (throttleInterval <= 0)
    {
        trySendEncodedSignal(signalType, signalData);
    }
    else
    {
        const attempt = (remaining: number) => {
            if (trySendEncodedSignal(signalType, signalData))
                return;
            if (remaining > 0)
                setTimeout(() => attempt(remaining - 1), retryInterval);
            else
                console.warn(`Signal '${signalType}' dropped after max retries`);
        };
        attempt(maxRetries);
    }
}

function trySendEncodedSignal(signalType: string, signalData: EncodableData): boolean
{
    if (!canEmit(signalType))
        return false;
    lastSignalSentTimes[signalType] = Date.now();

    const bufferState = EncodingUtil.startEncoding();
    signalData.encode(bufferState);
    const subBuffer = EncodingUtil.endEncoding(bufferState);
    socket.emit(signalType, subBuffer);
    return true;
}

function canEmit(signalType: string): boolean
{
    const lastSignalSentTime = lastSignalSentTimes[signalType];
    const throttleInterval = SignalTypeConfigMap.getConfigByType(signalType).throttleInterval;
    if (throttleInterval <= 0)
        return true;
    return lastSignalSentTime == undefined ||
        Date.now() >= lastSignalSentTime + throttleInterval + 200; // 200 = extra time margin (to reduce the chance that the signal will be rejected by the server due to an earlier signal arriving at the server too late)
}

export default GameSocketsClient;