import RemoveObjectSignal from "../../object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../object/types/setObjectMetadataSignal";
import RoomTexturePackChangedSignal from "../../room/types/roomTexturePackChangedSignal";
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

// (Requirements for signal routing):
// 1. Things needed when transmitting a signal from the client to the server (client -> server):
//      - A method in "socketsClient.ts" whose name starts with the prefix "emit" (This method is called by the client when emitting the signal to the server)
//      - The "onReceivedSignalFromUser" callback setup in "socketsServer.ts" (This tells the socket server how to respond to the signal emitted by the client)
// 2. Things needed when transmitting a signal from the server to the client (client <- server):
//      - Invocation of at least one of the following methods:
//          (1) "unicastSignal" in "socketRoomContext.ts"
//          (2) "multicastSignal" in "socketRoomContext.ts"
//          (3) "addPendingSignalToUser" in "socketUserContext.ts"
//          (4) "tryUpdateLatestPendingSignalToUser" in "socketUserContext.ts"

const signalTypeConfigPairs: [number, SignalTypeConfig][] = [
    //------------------------------------------------------------------------
    // Room Signals:
    //------------------------------------------------------------------------

    [0, { // Unidirectional (client -> server)
        // (Overall Flow):
        // The client sends its request to join a room to the server (i.e. "requestRoomChangeSignal").
        signalType: "requestRoomChangeSignal",
        minClientToServerSendInterval: 2000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => RequestRoomChangeSignal.decode(bufferState),
    }],
    [1, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server processes the "requestRoomChangeSignal" which was sent by the client.
        // The server sends the "roomChangedSignal" to the client.
        // The client receives the "roomChangedSignal" and loads the client-side instance of the room based on it.
        signalType: "roomChangedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because room-loading must be immediate on the client side.
        decode: (bufferState: BufferState) => RoomChangedSignal.decode(bufferState),
    }],
    [13, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server decides that the user cannot enter the room they were headed for
        // (e.g. because the room has reached its player capacity), so it sends the
        // "roomChangeRejectedSignal" instead of the "roomChangedSignal".
        // The client receives it, stops waiting for the room to load, and shows the reason.
        signalType: "roomChangeRejectedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because the client is blocked on a loading indicator until this arrives.
        decode: (bufferState: BufferState) => RoomChangeRejectedSignal.decode(bufferState),
    }],

    //------------------------------------------------------------------------
    // Object Signals:
    //------------------------------------------------------------------------

    [2, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // Client can send to request adding an object. Server validates and broadcasts to others.
        // Server can also announce that an object has been added (e.g. when a player joins).
        signalType: "addObjectSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => AddObjectSignal.decode(bufferState),
    }],
    [3, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // Client can send to request removing an object. Server validates and broadcasts to others.
        // Server can also announce that an object has been removed (e.g. when a player leaves).
        signalType: "removeObjectSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RemoveObjectSignal.decode(bufferState),
    }],
    [4, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // Each client sends its own object's transform (e.g. position, direction) to the server.
        // The server adjusts the received transform (in case physics needs to be applied) and broadcasts it to the other clients.
        signalType: "setObjectTransformSignal",
        minClientToServerSendInterval: 0, // should be 0 because object-syncing may happen at an extremely high frequency.
        maxClientSideReceptionPeriod: 2000, // Note: This value will be ignored if physics is involved.
        decode: (bufferState: BufferState) => SetObjectTransformSignal.decode(bufferState),
    }],
    [5, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client sets metadata on an object (e.g. canvas image URL) and reports it to the server.
        // The server validates and broadcasts to other clients.
        signalType: "setObjectMetadataSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetObjectMetadataSignal.decode(bufferState),
    }],

    //------------------------------------------------------------------------
    // Voxel Signals:
    //------------------------------------------------------------------------

    [6, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client adds a voxel block and reports it to the server.
        // The server validates and broadcasts to other clients.
        signalType: "addVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => AddVoxelBlockSignal.decode(bufferState),
    }],
    [7, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client removes a voxel block and reports it to the server.
        // The server validates and broadcasts to other clients.
        signalType: "removeVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RemoveVoxelBlockSignal.decode(bufferState),
    }],
    [8, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client moves a voxel block and reports it to the server.
        // The server validates and broadcasts to other clients.
        signalType: "moveVoxelBlockSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => MoveVoxelBlockSignal.decode(bufferState),
    }],
    [9, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client sets a voxel quad's texture and reports it to the server.
        // The server validates and broadcasts to other clients.
        signalType: "setVoxelQuadTextureSignal",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetVoxelQuadTextureSignal.decode(bufferState),
    }],
    [14, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // A superuser redraws the room's restricted zones and reports the whole list to the server.
        // The server validates and broadcasts to other clients.
        signalType: "setRestrictedZonesSignal",
        // A zone is redrawn by dragging it about, and the drag ends in one message rather than
        // sending one per frame — so this is rate-limited, unlike the voxel edits beside it, which
        // are each one deliberate act.
        minClientToServerSendInterval: 250,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => SetRestrictedZonesSignal.decode(bufferState),
    }],

    //------------------------------------------------------------------------
    // User Signals:
    //------------------------------------------------------------------------

    [10, { // Unidirectional (client -> server)
        // (Overall Flow):
        // The client sends a user-generated command (e.g. command to finish the tutorial) to the server.
        // The server processes the command.
        signalType: "userCommandSignal",
        minClientToServerSendInterval: 1000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => UserCommandSignal.decode(bufferState),
    }],
    // (Index 11 is retired. It carried a user's standing in the current room, back when a room could
    // hand one out; what a user may do in a room is now settled from who he is and which room it is,
    // so there is nothing left to announce. Left unused rather than reassigned, so that a client
    // running the previous bundle across a deployment cannot read a new signal as the old one.)
    [12, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server updates the room's texture pack path (via the REST API) and broadcasts the change to all clients in the room.
        // Each client receives the update and swaps the voxel mesh texture (by respawning the voxel objects) without a full room reload.
        signalType: "roomTexturePackChangedSignal",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => RoomTexturePackChangedSignal.decode(bufferState),
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
