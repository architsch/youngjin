import { HitboxSize } from "./hitboxSize";

export type ColliderConfig = {
    collisionLayerMaskAtGroundLevel: number, // 8-bit binary mask
    groundLevelY: number, // y-coordinate at which the ground level is located.
    hitboxSize: HitboxSize,
};