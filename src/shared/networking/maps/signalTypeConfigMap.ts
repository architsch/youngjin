import RemoveObjectSignal from "../../object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../object/types/setObjectMetadataSignal";
import RoomTexturePackChangedSignal from "../../room/types/roomTexturePackChangedSignal";
import RoomPrefsChangedSignal from "../../room/types/roomPrefsChangedSignal";
import AddObjectSignal from "../../object/types/addObjectSignal";
import SetObjectTransformSignal from "../../object/types/setObjectTransformSignal";
import UserCommandSignal from "../../user/types/userCommandSignal";
import RequestRoomChangeSignal from "../../room/types/requestRoomChangeSignal";
import RoomChangedSignal from "../../room/types/roomChangedSignal";
import RoomChangeRejectedSignal from "../../room/types/roomChangeRejectedSignal";
import AddVoxelBlockSignal from "../../voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../voxel/types/update/setVoxelQuadTextureSignal";
import SetRestrictedZonesSignal from "../../voxel/types/update/setRestrictedZonesSignal";
import BufferState from "../types/bufferState";
import SignalTypeConfig from "../types/signalTypeConfig";

// Signal routing requirements:
// - client -> server: an "emit..." method in socketsClient.ts and an "onReceivedSignalFromUser" handler
//   in socketsServer.ts.
// - server -> client: unicastSignal/multicastSignal (socketRoomContext.ts) or
//   addPendingSignalToUser/tryUpdateLatestPendingSignalToUser (socketUserContext.ts).

const signalTypeConfigPairs: [number, SignalTypeConfig][] = [
    // Room Signals

    [0, { // Unidirectional (client -> server)
        // Client requests to join a room.
        signalType: "requestRoomChangeSignal",
        minClientToServerSendInterval: 2000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => RequestRoomChangeSignal.decode(bufferState),
    }],
    [1, { // Unidirectional (client <- server)
        // Server answers requestRoomChangeSignal; the client loads the room.
        signalType: "roomChangedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because room-loading must be immediate on the client side.
        decode: (bufferState: BufferState) => RoomChangedSignal.decode(bufferState),
    }],
    [13, { // Unidirectional (client <- server)
        // Sent instead of roomChangedSignal when the user can't enter (e.g. the room is full); the client
        // stops waiting and shows the reason.
        signalType: "roomChangeRejectedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because the client is blocked on a loading indicator until this arrives.
        decode: (bufferState: BufferState) => RoomChangeRejectedSignal.decode(bufferState),
    }],

    // Object Signals

    [2, { // Bidirectional (client <-> server)
        // Client requests an add (server validates and relays), or the server announces one (e.g. a player joins).
        signalType: "addObjectSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => AddObjectSignal.decode(bufferState),
    }],
    [3, { // Bidirectional (client <-> server)
        // Client requests a removal (server validates and relays), or the server announces one (e.g. a player leaves).
        signalType: "removeObjectSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RemoveObjectSignal.decode(bufferState),
    }],
    [4, { // Bidirectional (client <-> server)
        // Clients send their object's transform; the server applies physics as needed and relays it.
        signalType: "setObjectTransformSignal",
        minClientToServerSendInterval: 0, // should be 0 because object-syncing may happen at an extremely high frequency.
        maxClientSideReceptionPeriod: 2000, // Note: This value will be ignored if physics is involved.
        decode: (bufferState: BufferState) => SetObjectTransformSignal.decode(bufferState),
    }],
    [5, { // Bidirectional (client <-> server)
        // Client sets object metadata (e.g. a canvas image); the server validates and relays.
        signalType: "setObjectMetadataSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetObjectMetadataSignal.decode(bufferState),
    }],

    // Voxel Signals

    [6, { // Bidirectional (client <-> server)
        // Client adds a block; the server validates and relays.
        signalType: "addVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => AddVoxelBlockSignal.decode(bufferState),
    }],
    [7, { // Bidirectional (client <-> server)
        // Client removes a block; the server validates and relays.
        signalType: "removeVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RemoveVoxelBlockSignal.decode(bufferState),
    }],
    [8, { // Bidirectional (client <-> server)
        // Client moves a block; the server validates and relays.
        signalType: "moveVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => MoveVoxelBlockSignal.decode(bufferState),
    }],
    [9, { // Bidirectional (client <-> server)
        // Client sets a quad texture; the server validates and relays.
        signalType: "setVoxelQuadTextureSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetVoxelQuadTextureSignal.decode(bufferState),
    }],
    [14, { // Bidirectional (client <-> server)
        // A superuser sends the room's full zone list; the server validates and relays.
        signalType: "setRestrictedZonesSignal",
        // Rate-limited, since zone drags can emit rapidly (unlike deliberate voxel edits).
        minClientToServerSendInterval: 250,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetRestrictedZonesSignal.decode(bufferState),
    }],

    // User Signals

    [10, { // Unidirectional (client -> server)
        // Client sends a user command (e.g. finish tutorial); the server processes it.
        signalType: "userCommandSignal",
        minClientToServerSendInterval: 1000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => UserCommandSignal.decode(bufferState),
    }],
    // (Index 11 is retired, not reused, so an old client bundle can't misread a new signal.)
    [12, { // Unidirectional (client <- server)
        // Server broadcasts a texture pack change (made via the REST API); clients swap the voxel texture
        // without reloading the room.
        signalType: "roomTexturePackChangedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RoomTexturePackChangedSignal.decode(bufferState),
    }],
    [15, { // Unidirectional (client <- server)
        // Server broadcasts a room prefs change (made via the REST API); clients apply it to the scene.
        signalType: "roomPrefsChangedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RoomPrefsChangedSignal.decode(bufferState),
    }],
];

const indexToConfig: {[signalTypeIndex: number]: SignalTypeConfig} = {};
const typeToIndex: {[signalType: string]: number} = {};

signalTypeConfigPairs.forEach(pair => {
    if (pair[0] < 0 || pair[0] > 255)
        throw new Error(`Signal type index is outside of its valid range (${pair[0]})`);
    indexToConfig[pair[0]] = pair[1];
    typeToIndex[pair[1].signalType] = pair[0];
});

const SignalTypeConfigMap =
{
    getConfigByType: (signalType: string): SignalTypeConfig =>
    {
        const signalTypeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        return SignalTypeConfigMap.getConfigByIndex(signalTypeIndex);
    },
    getConfigByIndex: (signalTypeIndex: number): SignalTypeConfig =>
    {
        const config = indexToConfig[signalTypeIndex];
        if (config == undefined)
            console.error(`getConfigByIndex :: Invalid signal type index (signalTypeIndex = ${signalTypeIndex})`);
        return config;
    },
    getIndexByType: (signalType: string): number =>
    {
        const signalTypeIndex = typeToIndex[signalType];
        if (signalTypeIndex == undefined)
            console.error(`getIndexByType :: Invalid signal type (signalType = ${signalType})`);
        return signalTypeIndex;
    },
    getMaxIndex: (): number =>
    {
        return signalTypeConfigPairs
            .map(pair => pair[0])
            .reduce((prev, curr) => curr >= prev ? curr : prev);
    },
}

export default SignalTypeConfigMap;
