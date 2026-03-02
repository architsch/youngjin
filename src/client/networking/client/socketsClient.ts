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
import { connectionStateObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import BufferState from "../../../shared/networking/types/bufferState";
import UpdateVoxelGridParams from "../../../shared/voxel/types/update/updateVoxelGridParams";
import SetVoxelQuadTextureParams from "../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import RemoveVoxelBlockParams from "../../../shared/voxel/types/update/removeVoxelBlockParams";
import AddVoxelBlockParams from "../../../shared/voxel/types/update/addVoxelBlockParams";
import MoveVoxelBlockParams from "../../../shared/voxel/types/update/moveVoxelBlockParams";
import UserCommandParams from "../../../shared/user/types/userCommandParams";
import UpdatePersistentObjectGroupParams from "../../../shared/object/types/update/updatePersistentObjectGroupParams";
import UpdatePersistentObjectGroupTaskParams from "../../../shared/object/types/update/updatePersistentObjectGroupTaskParams";
import App from "../../app";
import ObjectManager from "../../object/objectManager";
import PersistentObjectManager from "../../object/persistentObjectManager";
import VoxelManager from "../../voxel/voxelManager";

let socket: Socket;

const incomingSignalHandlers: {[signalType: string]: (data: EncodableData) => void} = {
    "roomRuntimeMemory": (data: EncodableData) =>
        App.changeRoom(data as RoomRuntimeMemory),
    "objectSyncParams": (data: EncodableData) =>
        ObjectManager.onObjectSyncReceived(data as ObjectSyncParams),
    "objectDesyncResolveParams": (data: EncodableData) =>
        ObjectManager.onObjectDesyncResolveReceived(data as ObjectDesyncResolveParams),
    "objectSpawnParams": (data: EncodableData) =>
        ObjectManager.onObjectSpawnReceived(data as ObjectSpawnParams),
    "objectDespawnParams": (data: EncodableData) =>
        ObjectManager.onObjectDespawnReceived(data as ObjectDespawnParams),
    "objectMessageParams": (data: EncodableData) =>
        ObjectManager.onObjectMessageReceived(data as ObjectMessageParams),
    "updateVoxelGridParams": (data: EncodableData) =>
        VoxelManager.onUpdateVoxelGridReceived(data as UpdateVoxelGridParams),
    "updatePersistentObjectGroupParams": (data: EncodableData) =>
        PersistentObjectManager.onUpdatePersistentObjectGroupReceived(data as UpdatePersistentObjectGroupParams),
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
                // auto-join flow (which sends roomRuntimeMemory) can complete.
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
    {
        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
        {
            console.error("Modified a voxel, but the current room doesn't exist.");
            return;
        }
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams(currentRoom.id, [params]));
    },
    emitAddVoxelBlock: (params: AddVoxelBlockParams) =>
    {
        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
        {
            console.error("Modified a voxel, but the current room doesn't exist.");
            return;
        }
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams(currentRoom.id, [params]));
    },
    emitRemoveVoxelBlock: (params: RemoveVoxelBlockParams) =>
    {
        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
        {
            console.error("Modified a voxel, but the current room doesn't exist.");
            return;
        }
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams(currentRoom.id, [params]));
    },
    emitSetVoxelQuadTexture: (params: SetVoxelQuadTextureParams) =>
    {
        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
        {
            console.error("Modified a voxel, but the current room doesn't exist.");
            return;
        }
        emitWhenReady("updateVoxelGridParams", new UpdateVoxelGridParams(currentRoom.id, [params]));
    },
    emitUpdatePersistentObjectGroup: (params: UpdatePersistentObjectGroupTaskParams) =>
    {
        const currentRoom = App.getCurrentRoom();
        if (!currentRoom)
        {
            console.error("Modified a persistent object, but the current room doesn't exist.");
            return;
        }
        emitWhenReady("updatePersistentObjectGroupParams",
            new UpdatePersistentObjectGroupParams(currentRoom.id, [params]));
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