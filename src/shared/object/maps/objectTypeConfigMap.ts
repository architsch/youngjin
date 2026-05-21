import ObjectTypeConfig from "../types/objectTypeConfig/objectTypeConfig";
import VoxelObjectTypeConfig from "../types/objectTypeConfig/voxelObjectTypeConfig";
import PlayerObjectTypeConfig from "../types/objectTypeConfig/playerObjectTypeConfig";
import CanvasObjectTypeConfig from "../types/objectTypeConfig/canvasObjectTypeConfig";
import DoorObjectTypeConfig from "../types/objectTypeConfig/doorObjectTypeConfig";

// This map specifies all types of GameObject and their global configs.
// Each config specifies all types of GameObjectComponents which must be included in the
// GameObject when it spawns (Each GameObject can have one or more GameObjectComponents in it).
const objectTypeConfigPairs: [number, ObjectTypeConfig][] = [
    [0, VoxelObjectTypeConfig],
    [1, PlayerObjectTypeConfig],
    [2, CanvasObjectTypeConfig],
    [3, DoorObjectTypeConfig],
];

const indexToConfig: {[objectTypeIndex: number]: ObjectTypeConfig} = {};
const typeToIndex: {[objectType: string]: number} = {};

objectTypeConfigPairs.forEach(pair => {
    indexToConfig[pair[0]] = pair[1];
    typeToIndex[pair[1].objectType] = pair[0];
});

const ObjectTypeConfigMap =
{
    getConfigByIndex: (objectTypeIndex: number): ObjectTypeConfig =>
    {
        const config = indexToConfig[objectTypeIndex];
        if (config == undefined)
            throw new Error(`getConfigByIndex :: Invalid object type index (objectTypeIndex = ${objectTypeIndex})`);
        return config;
    },
    getIndexByType: (objectType: string): number =>
    {
        const objectTypeIndex = typeToIndex[objectType];
        if (objectTypeIndex == undefined)
            throw new Error(`getIndexByType :: Invalid object type (objectType = ${objectType})`);
        return objectTypeIndex;
    },
}

export default ObjectTypeConfigMap;