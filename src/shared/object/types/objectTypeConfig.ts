import { HitboxSize } from "../../physics/types/hitboxSize";

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";

export default interface ObjectTypeConfig
{
    objectType: string;
    components: {
        spawnedByAny?: {
            dynamicCollider?: {
                collisionLayerMaskAtGroundLevel: number,
                hitboxSize: HitboxSize,
            },
            staticCollider?: {
                collisionLayerMaskAtGroundLevel: number,
                hitboxSize: HitboxSize,
            },
            instancedMeshGraphics?: {
                createInstanceIdPool: boolean,
            },
            voxelMeshInstancer?: {
            },
            persistentObjectMeshInstancer?: {
            },
            speechBubble?: {
                yOffset: number,
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