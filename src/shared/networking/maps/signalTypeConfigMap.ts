import ObjectDespawnParams from "../../object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../object/types/objectDesyncResolveParams";
import ObjectMessageParams from "../../object/types/objectMessageParams";
import UserRoleUpdateParams from "../../user/types/userRoleUpdateParams";
import ObjectSpawnParams from "../../object/types/objectSpawnParams";
import ObjectSyncParams from "../../object/types/objectSyncParams";
import UserCommandParams from "../../user/types/userCommandParams";
import RoomChangeRequestParams from "../../room/types/roomChangeRequestParams";
import RoomRuntimeMemory from "../../room/types/roomRuntimeMemory";
import UpdateVoxelGridParams from "../../voxel/types/update/updateVoxelGridParams";
import UpdatePersistentObjectGroupParams from "../../object/types/update/updatePersistentObjectGroupParams";
import BufferState from "../types/bufferState";
import SignalTypeConfig from "../types/signalTypeConfig";

// (Requirements for signal routing):
// 1. Things needed when transmitting a signal from the client to the server (client -> server):
//      - A method in "gameSocketsClient.ts" whose name starts with the prefix "emit" (This method is called by the client when emitting the signal to the server)
//      - The "onReceivedSignalFromUser" callback setup in "gameSockets.ts" (This tells the socket server how to respond to the signal emitted by the client)
// 2. Things needed when transmitting a signal from the server to the client (client <- server):
//      - Invocation of at least one of the following methods:
//          (1) "unicastSignal" in "socketRoomContext.ts"
//          (2) "multicastSignal" in "socketRoomContext.ts"
//          (3) "addPendingSignalToUser" in "socketUserContext.ts"
//          (4) "tryUpdateLatestPendingSignalToUser" in "socketUserContext.ts"

const signalTypeConfigPairs: [number, SignalTypeConfig][] = [
    [0, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server announces that an object has despawned.
        // Each client receives the announcement and despawns the corresponding client-side object instance.
        signalType: "objectDespawnParams",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000, // this handles the case in which another user's object despawns while the room is still loading on the client side, etc.
        decode: (bufferState: BufferState) => ObjectDespawnParams.decode(bufferState),
    }],
    [1, { // Unidirectional (client <- server)
        // (Overall Flow):
        // When a client-side PhysicsObject is not in sync with the corresponding server-side PhysicsObject, the server reports this incident to the client who owns that object.
        // The desynced client adjusts the problematic PhysicsObject to let it sync up with the server-side PhysicsObject.
        signalType: "objectDesyncResolveParams",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because, even if a signal fails to be applied immediately due to circumstances, a subsequent sync-up signal will resolve the discrepancy in the object's transform anyways.
        decode: (bufferState: BufferState) => ObjectDesyncResolveParams.decode(bufferState),
    }],
    [2, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // Each client sends its own object's message to the server.
        // The server broadcasts the received message to the other clients.
        signalType: "objectMessageParams",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000, // this handles the case in which another user's object sends a message while the room is still loading on the client side, etc.
        decode: (bufferState: BufferState) => ObjectMessageParams.decode(bufferState),
    }],
    [3, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server announces that an object has spawned.
        // Each client receives the announcement and spawns a corresponding client-side object instance.
        signalType: "objectSpawnParams",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000, // this handles the case in which another user's object spawns while the room is still loading on the client side, etc.
        decode: (bufferState: BufferState) => ObjectSpawnParams.decode(bufferState),
    }],
    [4, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // Each client sends its own object's transform (e.g. position, direction) to the server.
        // The server broadcasts the received transform to the other clients.
        signalType: "objectSyncParams",
        minClientToServerSendInterval: 0, // should be 0 because object-syncing may happen at an extremely high frequency.
        maxClientSideReceptionPeriod: 0, // should be 0 because, even if a signal fails to be applied immediately due to circumstances, a subsequent sync-up signal will resolve the discrepancy in the object's transform anyways.
        decode: (bufferState: BufferState) => ObjectSyncParams.decode(bufferState),
    }],
    [5, { // Unidirectional (client -> server)
        // (Overall Flow):
        // The client sends its request to join a room to the server (i.e. "roomChangeRequestParams").
        signalType: "roomChangeRequestParams",
        minClientToServerSendInterval: 2000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => RoomChangeRequestParams.decode(bufferState),
    }],
    [6, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server processes the "roomChangeRequestParams" which was sent by the client.
        // The server sends the room's "roomRuntimeMemory" to the client.
        // The client receives the "roomRuntimeMemory" and loads the client-side instance of the room based on it.
        signalType: "roomRuntimeMemory",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 0, // should be 0 because room-loading must be immediate on the client side.
        decode: (bufferState: BufferState) => RoomRuntimeMemory.decode(bufferState),
    }],
    [7, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client makes an update to the existing client-side voxelGrid, and reports this update to the server (i.e. "updateVoxelGridParams").
        // The server applies this update to the server-side voxelGrid, and also announces it to the other clients.
        // The other clients receive the update info and sync up their client-side voxelGrids accordingly.
        signalType: "updateVoxelGridParams",
        minClientToServerSendInterval: 0, // should be 0 because voxelGrid-update may happen at an extremely high frequency.
        maxClientSideReceptionPeriod: 2000, // this handles the case in which another user modifies the voxelGrid while the room is still loading on the client side, etc.
        decode: (bufferState: BufferState) => UpdateVoxelGridParams.decode(bufferState),
    }],
    [8, { // Bidirectional (client <-> server)
        // (Overall Flow):
        // The client makes an update to the existing client-side persistentObjectGroup, and reports this update to the server (i.e. "updatePersistentObjectGroupParams").
        // The server applies this update to the server-side persistentObjectGroup, and also announces it to the other clients.
        // The other clients receive the update info and sync up their client-side persistentObjectGroups accordingly.
        signalType: "updatePersistentObjectGroupParams",
        minClientToServerSendInterval: 0,
        maxClientSideReceptionPeriod: 2000,
        decode: (bufferState: BufferState) => UpdatePersistentObjectGroupParams.decode(bufferState),
    }],
    [9, { // Unidirectional (client -> server)
        // (Overall Flow):
        // The client sends a user-generated command (e.g. a command to increase the user's tutorialStep) to the server.
        // The server processes the command.
        signalType: "userCommandParams",
        minClientToServerSendInterval: 1000, // This is necessary because this signal may cost a DB query each time it gets sent.
        maxClientSideReceptionPeriod: 0, // not used because the client never receives this signal from the server.
        decode: (bufferState: BufferState) => UserCommandParams.decode(bufferState),
    }],
    [10, { // Unidirectional (client <- server)
        // (Overall Flow):
        // The server updates a user's role in the current room and announces the update to all clients in the room.
        // Each client receives the update and applies the new role (e.g. updating UI permissions).
        signalType: "userRoleUpdateParams",
        minClientToServerSendInterval: 0, // not used because the client never sends this signal to the server.
        maxClientSideReceptionPeriod: 2000, // this handles the case in which the role update arrives while the room is still loading on the client side, etc.
        decode: (bufferState: BufferState) => UserRoleUpdateParams.decode(bufferState),
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