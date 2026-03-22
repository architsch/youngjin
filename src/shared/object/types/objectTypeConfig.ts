import { ColliderConfig } from "../../physics/types/colliderConfig";

export default interface ObjectTypeConfig
{
    objectType: string;
    persistent: boolean;
    components: {
        spawnedByAny?: {
            collider?: ColliderConfig,
            instancedMeshGraphics?: {
                createInstanceIdPool: boolean,
            },
            speechBubble?: {
                yOffset: number,
                prependUserNameToMessage: boolean,
                showMessageIfSpawnedByMe: boolean,
                showMessageIfSpawnedByOther: boolean,
            },
            playerProximityDetector?: {
                maxDist: number,
                maxLookAngle: number,
            },
        },
        spawnedByMe?: {
            firstPersonController?: {},
            periodicTransformEmitter?: {},
            physicsUpdater?: {},
        },
        spawnedByOther?: {
            periodicTransformReceiver?: {},
            modelGraphics?: {
                path: string,
                localPosition: {x: number, y: number, z: number},
                scale: {x: number, y: number, z: number},
            },
        },
    },
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";