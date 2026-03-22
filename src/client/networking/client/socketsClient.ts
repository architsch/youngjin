import { io, Socket } from "socket.io-client";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import RoomChangedSignal from "../../../shared/room/types/roomChangedSignal";
import ThingsPoolEnv from "../../system/types/thingsPoolEnv";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableData from "../../../shared/networking/types/encodableData";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import { connectionStateObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import BufferState from "../../../shared/networking/types/bufferState";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../shared/voxel/types/update/moveVoxelBlockSignal";
import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import SetUserRoleSignal from "../../../shared/user/types/setUserRoleSignal";
import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import ClientVoxelManager from "../../voxel/clientVoxelManager";

let socket: Socket;

const incomingSignalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
    "roomChangedSignal": (data: EncodableData) =>
        App.onRoomChangedSignalReceived(data as RoomChangedSignal),
    "addObjectSignal": (data: EncodableData) =>
        ClientObjectManager.onAddObjectSignalReceived(data as AddObjectSignal),
    "removeObjectSignal": (data: EncodableData) =>
        ClientObjectManager.onRemoveObjectSignalReceived(data as RemoveObjectSignal),
    "setObjectTransformSignal": (data: EncodableData) =>
        ClientObjectManager.onSetObjectTransformSignalReceived(data as SetObjectTransformSignal),
    "setObjectMetadataSignal": (data: EncodableData) =>
        ClientObjectManager.onSetObjectMetadataSignalReceived(data as SetObjectMetadataSignal),
    "addVoxelBlockSignal": (data: EncodableData) =>
        ClientVoxelManager.onAddVoxelBlockSignalReceived(data as AddVoxelBlockSignal),
    "moveVoxelBlockSignal": (data: EncodableData) =>
        ClientVoxelManager.onMoveVoxelBlockSignalReceived(data as MoveVoxelBlockSignal),
    "removeVoxelBlockSignal": (data: EncodableData) =>
        ClientVoxelManager.onRemoveVoxelBlockSignalReceived(data as RemoveVoxelBlockSignal),
    "setVoxelQuadTextureSignal": (data: EncodableData) =>
        ClientVoxelManager.onSetVoxelQuadTextureSignalReceived(data as SetVoxelQuadTextureSignal),
    "setUserRoleSignal": (data: EncodableData) =>
        App.onSetUserRoleSignalReceived(data as SetUserRoleSignal),
}

const lastSignalSentTimes: {[signalType: string]: number} = {};

const SocketsClient =
{
    init: (env: ThingsPoolEnv) =>
    {
        if (!tryStartClientProcess("roomChange", 1, 0))
            throw new Error("'roomChange' process is already ongoing.");

        const connectionURL = env.socket_server_url;
        console.log(`Attempting to establish a socket connection with: [${connectionURL}]`);
        socket = io(connectionURL, {
            transports: ["websocket", "polling"],
            upgrade: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            auth: { targetRoomID: env.targetRoomID },
        });

        // Expose for E2E test teardown (explicit disconnect prevents stale players)
        (window as any).__socket_io_instance = socket;

        let hasConnectedBefore = false;

        socket.on("connect", () => {
            console.log(`Successfully connected to socket server (transport: ${socket.io.engine.transport.name})`);
            connectionStateObservable.set("connected");
            if (hasConnectedBefore)
            {
                // Reconnection: start a new roomChange process so the server's
                // auto-join flow (which sends roomChangedSignal) can complete.
                tryStartClientProcess("roomChange", 1, 0);
            }
            hasConnectedBefore = true;
        });

        socket.on("forceRedirect", (url: string) => {
            window.location.href = url;
        });

        socket.on("disconnect", (reason) => {
            console.warn(`Socket disconnected (reason: ${reason})`);
            connectionStateObservable.set("reconnecting");

            if (reason === "io server disconnect")
            {
                // Server-initiated disconnect (graceful shutdown / deployment).
                // Socket.IO won't auto-reconnect for this reason, so poll
                // the server until it's back up and then reload the page.
                pollServerAndReload(env.socket_server_url);
            }
        });

        socket.io.on("reconnect_failed", () => {
            // All automatic reconnection attempts exhausted (network disconnect).
            console.warn("All reconnection attempts exhausted. Reloading page...");
            connectionStateObservable.set("disconnected");
            window.location.reload();
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

    emitSetObjectTransformSignal: (params: SetObjectTransformSignal) => emitWhenReady("setObjectTransformSignal", params),
    emitUserCommandSignal: (params: UserCommandSignal) => emitWhenReady("userCommandSignal", params),
    tryEmitRequestRoomChangeSignal: (params: RequestRoomChangeSignal) => {
        if (tryStartClientProcess("roomChange", 1, 1))
            emitWhenReady("requestRoomChangeSignal", params);
        else
            console.warn("Cannot change room because 'roomChange' process is ongoing.");
    },
    emitMoveVoxelBlockSignal: (params: MoveVoxelBlockSignal) =>
    {
        emitWhenReady("moveVoxelBlockSignal", params);
    },
    emitAddVoxelBlockSignal: (params: AddVoxelBlockSignal) =>
    {
        emitWhenReady("addVoxelBlockSignal", params);
    },
    emitRemoveVoxelBlockSignal: (params: RemoveVoxelBlockSignal) =>
    {
        emitWhenReady("removeVoxelBlockSignal", params);
    },
    emitSetVoxelQuadTextureSignal: (params: SetVoxelQuadTextureSignal) =>
    {
        emitWhenReady("setVoxelQuadTextureSignal", params);
    },
    emitAddObjectSignal: (params: AddObjectSignal) =>
    {
        emitWhenReady("addObjectSignal", params);
    },
    emitRemoveObjectSignal: (params: RemoveObjectSignal) =>
    {
        emitWhenReady("removeObjectSignal", params);
    },
    emitSetObjectMetadataSignal: (params: SetObjectMetadataSignal) =>
    {
        emitWhenReady("setObjectMetadataSignal", params);
    },
}

function emitWhenReady(signalType: string, signalData: EncodableData,
    maxRetries: number = 10, retryInterval: number = 200)
{
    const minClientToServerSendInterval = SignalTypeConfigMap.getConfigByType(signalType).minClientToServerSendInterval;
    if (minClientToServerSendInterval <= 0)
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

function pollServerAndReload(serverUrl: string, interval: number = 3000)
{
    const poll = () => {
        fetch(serverUrl, { method: "HEAD", mode: "no-cors" })
            .then(() => window.location.reload())
            .catch(() => setTimeout(poll, interval));
    };
    setTimeout(poll, interval);
}

function canEmit(signalType: string): boolean
{
    const lastSignalSentTime = lastSignalSentTimes[signalType];
    const minClientToServerSendInterval = SignalTypeConfigMap.getConfigByType(signalType).minClientToServerSendInterval;
    if (minClientToServerSendInterval <= 0)
        return true;
    return lastSignalSentTime == undefined ||
        Date.now() >= lastSignalSentTime + minClientToServerSendInterval + 200; // 200 = extra time margin (to reduce the chance that the signal will be rejected by the server due to an earlier signal arriving at the server too late)
}

export default SocketsClient;
