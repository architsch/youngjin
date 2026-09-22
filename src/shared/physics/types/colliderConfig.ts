import Vec3 from "../../math/types/vec3";
import { ColliderType } from "./colliderType";
import { HitboxSize } from "./hitboxSize";

export type ColliderConfig = {
    colliderType: ColliderType,
    baseHitboxSize: HitboxSize, // The footprint at unit scale; an object's own is this times its scale.
    applyHardCollisionToOthers: boolean,
    outgoingSoftCollisionForceMultiplier: number,
    outgoingSoftCollisionForceLimit?: Vec3; // force magnitude limit in x,y,z directions
    incomingSoftCollisionForceMultiplier: number,
    maxClimbableHeight: number,
};