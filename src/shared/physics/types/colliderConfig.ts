import { ColliderType } from "./colliderType";
import { HitboxSize } from "./hitboxSize";

export type ColliderConfig = {
    colliderType: ColliderType,
    hitboxSize: HitboxSize,
    applyHardCollisionToOthers: boolean,
    outgoingSoftCollisionForceMultiplier: number,
    incomingSoftCollisionForceMultiplier: number,
    maxClimbableHeight: number,
};