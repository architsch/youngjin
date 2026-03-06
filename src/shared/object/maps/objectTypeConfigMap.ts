import ObjectTypeConfig from "../types/objectTypeConfig";

// This map specifies all types of GameObject and their global configs.
// Each config specifies all types of GameObjectComponents which must be included in the
// GameObject when it spawns (Each GameObject can have one or more GameObjectComponents in it).
const objectTypeConfigPairs: [number, ObjectTypeConfig][] = [
    [0, { // This object represents each voxel in the room's voxelGrid. Each voxel consists of blocks, and each block consists of quads (aka "voxelQuads").
        objectType: "Voxel",
        components: {
            spawnedByAny: {
                // Collider is not needed here because the physics system handles voxels under a separate logic.
                instancedMeshGraphics: {
                    createInstanceIdPool: false,
                },
            },
        },
    }],
    [1, { // This object represents each user's player character. Users directly control their player characters in first-person view, using input devices (such as mouse and keyboard).
        objectType: "Player",
        components: {
            spawnedByAny: {
                dynamicCollider: {
                    collisionLayerMaskAtGroundLevel: 0b00011111,
                    hitboxSize: {sizeX: 0.6, sizeZ: 0.6},
                },
                speechBubble: {
                    yOffset: 2.4,
                    prependUserNameToMessage: true,
                    showMessageIfSpawnedByMe: false,
                    showMessageIfSpawnedByOther: true,
                },
                playerProximityDetector: {
                    maxDist: 0.45,
                    maxLookAngle: -1,
                },
            },
            spawnedByMe: {
                firstPersonController: {},
                objectSyncEmitter: {},
            },
            spawnedByOther: {
                modelGraphics: {
                    path: "lowpolyghost/lowpolyghost.glb",
                    localPosition: {x: 0, y: 1.22, z: 0},
                    scale: {x: 0.3, y: 0.3, z: 0.3},
                },
                objectSyncReceiver: {},
            },
        },
    }],
    [2, { // This object represents a canvas (image) that can be exhibited in the room (like a painting in an art gallery).
        objectType: "Canvas",
        isWallAttached: true,
        components: {
            spawnedByAny: {
                ghostCollider: {
                    collisionLayerMaskAtGroundLevel: 0,
                    hitboxSize: {sizeX: 1, sizeZ: 0},
                },
                instancedMeshGraphics: {
                    createInstanceIdPool: true,
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