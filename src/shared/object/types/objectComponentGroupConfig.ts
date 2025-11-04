import { HitboxSize } from "../../physics/types/hitboxSize";

export default interface ObjectComponentGroupConfig
{
    collider?: {
        collisionLayer: number,
        hitboxSize: HitboxSize,
    },
    firstPersonController?: {
    },
    instancedMeshGraphics?: {
    },
    modelGraphics?: {
        path: string,
        localPosition: {x: number, y: number, z: number},
        scale: {x: number, y: number, z: number},
    },
    objectSyncEmitter?: {
    },
    objectSyncReceiver?: {
    },
    speechBubble?: {
        yOffset: number,
    },
    voxelObject?: {
    },
}