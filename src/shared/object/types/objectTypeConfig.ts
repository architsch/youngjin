import { HitboxSize } from "../../physics/types/hitboxSize";

export type SpawnType = "spawnedByMe" | "spawnedByOther" | "spawnedByAny";

export default interface ObjectTypeConfig
{
    objectType: string;
    isWallAttached?: boolean; // TRUE if the object should always stay attached to the nearest wall (e.g. canvas)
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