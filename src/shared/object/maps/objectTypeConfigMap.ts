import ObjectTypeConfig from "../types/objectTypeConfig/objectTypeConfig";
import VoxelObjectTypeConfig from "../types/objectTypeConfig/voxelObjectTypeConfig";
import PlayerObjectTypeConfig from "../types/objectTypeConfig/playerObjectTypeConfig";
import CanvasObjectTypeConfig from "../types/objectTypeConfig/canvasObjectTypeConfig";
import DoorObjectTypeConfig from "../types/objectTypeConfig/doorObjectTypeConfig";
import LampObjectTypeConfig from "../types/objectTypeConfig/lampObjectTypeConfig";
import LabelObjectTypeConfig from "../types/objectTypeConfig/labelObjectTypeConfig";
import PropObjectTypeConfig from "../types/objectTypeConfig/propObjectTypeConfig";
import NpcObjectTypeConfig from "../types/objectTypeConfig/npcObjectTypeConfig";
import VolumeObjectTypeConfig from "../types/objectTypeConfig/volumeObjectTypeConfig";
import FanObjectTypeConfig from "../types/objectTypeConfig/fanObjectTypeConfig";
import MirrorObjectTypeConfig from "../types/objectTypeConfig/mirrorObjectTypeConfig";
import DollarBillObjectTypeConfig from "../types/objectTypeConfig/dollarBillObjectTypeConfig";
import CannonObjectTypeConfig from "../types/objectTypeConfig/cannonObjectTypeConfig";
import CannonBallObjectTypeConfig from "../types/objectTypeConfig/cannonBallObjectTypeConfig";
import { ObjectCategoryEnumMap } from "../types/objectCategory";

// All GameObject types and the components each spawns with. Type indices are stored with objects, so
// they are append-only. The list is read lazily on first lookup, because configs import this map (an
// import cycle whose evaluation order varies).
function getObjectTypeConfigPairs(): [number, ObjectTypeConfig][]
{
    return [
        [0, VoxelObjectTypeConfig],
        [1, PlayerObjectTypeConfig],
        [2, CanvasObjectTypeConfig],
        [3, DoorObjectTypeConfig],
        [4, LampObjectTypeConfig],
        [5, LabelObjectTypeConfig],
        [6, PropObjectTypeConfig],
        [7, NpcObjectTypeConfig],
        [8, VolumeObjectTypeConfig],
        [9, FanObjectTypeConfig],
        [10, MirrorObjectTypeConfig],
        [11, DollarBillObjectTypeConfig],
        [12, CannonObjectTypeConfig],
        [13, CannonBallObjectTypeConfig],
    ];
}

const indexToConfig: {[objectTypeIndex: number]: ObjectTypeConfig} = {};
const typeToIndex: {[objectType: string]: number} = {};
let indexed = false;

function ensureIndexed()
{
    if (indexed)
        return;
    indexed = true;
    getObjectTypeConfigPairs().forEach(pair => {
        indexToConfig[pair[0]] = pair[1];
        typeToIndex[pair[1].objectType] = pair[0];
    });
}

const ObjectTypeConfigMap =
{
    getConfigByIndex: (objectTypeIndex: number): ObjectTypeConfig =>
    {
        ensureIndexed();
        const config = indexToConfig[objectTypeIndex];
        if (config == undefined)
            throw new Error(`getConfigByIndex :: Invalid object type index (objectTypeIndex = ${objectTypeIndex})`);
        return config;
    },
    getIndexByType: (objectType: string): number =>
    {
        ensureIndexed();
        const objectTypeIndex = typeToIndex[objectType];
        if (objectTypeIndex == undefined)
            throw new Error(`getIndexByType :: Invalid object type (objectType = ${objectType})`);
        return objectTypeIndex;
    },
    hasType: (objectType: string): boolean =>
    {
        ensureIndexed();
        return typeToIndex[objectType] != undefined;
    },
    getAllConfigs: (): ObjectTypeConfig[] =>
    {
        ensureIndexed();
        return Object.values(indexToConfig);
    },
    // What a room's stored contents hold: what persists, and what lies about it to be collected or flies through it,
    // which outlasts its unloading and a restart without being any part of what is built, so that it is in no file
    // of it (see DollarBillUtil, CannonBallUtil).
    isStoredWithRoom: (objectTypeIndex: number): boolean =>
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
        return config.persistent || config.category == ObjectCategoryEnumMap.Collectible
            || config.category == ObjectCategoryEnumMap.CannonBall;
    },
}

export default ObjectTypeConfigMap;