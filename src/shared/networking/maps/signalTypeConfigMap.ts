import ObjectDespawnParams from "../../object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../object/types/objectDesyncResolveParams";
import ObjectMessageParams from "../../object/types/objectMessageParams";
import ObjectSpawnParams from "../../object/types/objectSpawnParams";
import ObjectSyncParams from "../../object/types/objectSyncParams";
import RoomChangeRequestParams from "../../room/types/roomChangeRequestParams";
import RoomRuntimeMemory from "../../room/types/roomRuntimeMemory";
import VoxelCubeAddParams from "../../voxel/types/voxelCubeAddParams";
import VoxelCubeChangeYParams from "../../voxel/types/voxelCubeChangeYParams";
import VoxelCubeRemoveParams from "../../voxel/types/voxelCubeRemoveParams";
import VoxelTextureChangeParams from "../../voxel/types/voxelTextureChangeParams";
import BufferState from "../types/bufferState";
import SignalTypeConfig from "../types/signalTypeConfig";

const signalTypeConfigPairs: [number, SignalTypeConfig][] = [
    [0, {
        signalType: "objectDespawnParams",
        decode: (bufferState: BufferState) => ObjectDespawnParams.decode(bufferState),
    }],
    [1, {
        signalType: "objectDesyncResolveParams",
        decode: (bufferState: BufferState) => ObjectDesyncResolveParams.decode(bufferState),
    }],
    [2, {
        signalType: "objectMessageParams",
        decode: (bufferState: BufferState) => ObjectMessageParams.decode(bufferState),
    }],
    [3, {
        signalType: "objectSpawnParams",
        decode: (bufferState: BufferState) => ObjectSpawnParams.decode(bufferState),
    }],
    [4, {
        signalType: "objectSyncParams",
        decode: (bufferState: BufferState) => ObjectSyncParams.decode(bufferState),
    }],
    [5, {
        signalType: "roomChangeRequestParams",
        decode: (bufferState: BufferState) => RoomChangeRequestParams.decode(bufferState),
    }],
    [6, {
        signalType: "roomRuntimeMemory",
        decode: (bufferState: BufferState) => RoomRuntimeMemory.decode(bufferState),
    }],
    [7, {
        signalType: "voxelCubeAddParams",
        decode: (bufferState: BufferState) => VoxelCubeAddParams.decode(bufferState),
    }],
    [8, {
        signalType: "voxelCubeRemoveParams",
        decode: (bufferState: BufferState) => VoxelCubeRemoveParams.decode(bufferState),
    }],
    [9, {
        signalType: "voxelTextureChangeParams",
        decode: (bufferState: BufferState) => VoxelTextureChangeParams.decode(bufferState),
    }],
    [10, {
        signalType: "voxelCubeChangeYParams",
        decode: (bufferState: BufferState) => VoxelCubeChangeYParams.decode(bufferState),
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