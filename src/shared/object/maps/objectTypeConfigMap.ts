import ObjectTypeConfig from "../types/objectTypeConfig/objectTypeConfig";
import VoxelObjectTypeConfig from "../types/objectTypeConfig/voxelObjectTypeConfig";
import PlayerObjectTypeConfig from "../types/objectTypeConfig/playerObjectTypeConfig";
import CanvasObjectTypeConfig from "../types/objectTypeConfig/canvasObjectTypeConfig";
import DoorObjectTypeConfig from "../types/objectTypeConfig/doorObjectTypeConfig";
import LampObjectTypeConfig from "../types/objectTypeConfig/lampObjectTypeConfig";

// This map specifies all types of GameObject and their global configs.
// Each config specifies all types of GameObjectComponents which must be included in the
// GameObject when it spawns (Each GameObject can have one or more GameObjectComponents in it).
//
// **The index a type is filed under is what every stored object names itself by, so these numbers
// are appended and never reordered** — a number that changes meaning turns every object already
// saved into an object of some other kind.
//
// The list is read on first lookup rather than while this module is being evaluated. Every config
// imports this map back — a door has to know its own type index in order to build one — so the two
// are a cycle, and whichever of them a program happens to reach first is evaluated first. Reaching
// a config first is the ordinary case now that a type's own constants and util live on it, and
// reading the configs at that moment would read them half-declared. Deferring the read to the first
// lookup, which cannot happen before every module has finished loading, is what makes the order
// stop mattering.
function getObjectTypeConfigPairs(): [number, ObjectTypeConfig][]
{
    return [
        [0, VoxelObjectTypeConfig],
        [1, PlayerObjectTypeConfig],
        [2, CanvasObjectTypeConfig],
        [3, DoorObjectTypeConfig],
        [4, LampObjectTypeConfig],
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
}

export default ObjectTypeConfigMap;