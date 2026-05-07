import Vec3 from "../../math/types/vec3";
import { ColliderType } from "./colliderType";
import { HitboxSize } from "./hitboxSize";

export type ColliderConfig = {
    colliderType: ColliderType,
    hitboxSize: HitboxSize,
    applyHardCollisionToOthers: boolean,
    outgoingSoftCollisionForceMultiplier: number,
    outgoingSoftCollisionForceLimit?: Vec3; // force magnitude limit in x,y,z directions
    incomingSoftCollisionForceMultiplier: number,
    maxClimbableHeight: number,
};