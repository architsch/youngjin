import { ColliderConfig } from "../../physics/types/colliderConfig";
import { ObjectTag } from "./objectTag";

export default interface ObjectTypeConfig
{
    objectType: string;
    tags: ObjectTag[];
    components: {
        spawnedByAny?: {
            dynamicCollider?: ColliderConfig,
            staticCollider?: ColliderConfig,
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
            firstPersonController?: {
            },
            objectSyncEmitter?: {
            },
        },
        spawnedByOther?: {
            objectSyncReceiver?: {
            },
            modelGraphics?: {
                path: string,
                localPosition: {x: number, y: number, z: number},
                scale: {x: number, y: number, z: number},
            },
        },
    },
}

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";