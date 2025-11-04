import ObjectTypeConfig from "../types/objectTypeConfig";

const objectTypeConfigPairs: [number, ObjectTypeConfig][] = [
    [0, {
        objectType: "Voxel",
        components: {
            spawnedByAny: {
                instancedMeshGraphics: {},
                voxelObject: {},
            },
        },
    }],
    [1, {
        objectType: "Player",
        components: {
            spawnedByAny: {
                collider: {
                    collisionLayer: 0,
                    hitboxSize: {sizeX: 0.6, sizeZ: 0.6},
                },
            },
            spawnedByMe: {
                firstPersonController: {},
                objectSyncEmitter: {},
            },
            spawnedByOther: {
                modelGraphics: {
                    path: "lowpolyghost/lowpolyghost.glb",
                    localPosition: {x: 0, y: 0.13, z: 0},
                    scale: {x: 0.7, y: 0.7, z: 0.7},
                },
                objectSyncReceiver: {},
                speechBubble: {
                    yOffset: 3,
                },
            },
        },
    }],
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