import Vec3 from "../../math/types/vec3";
import { HitboxSize } from "./hitboxSize";

// How a collider takes part in physics. Whether its object is driven by physics is the type's Rigidbody
// component; whether it is fixed to a surface is the type's attachment (see ObjectTypeConfig).
export type ColliderConfig = {
    baseHitboxSize: HitboxSize, // The footprint at unit scale; an object's own is this times its scale.
    applyHardCollisionToOthers: boolean,
    outgoingSoftCollisionForceMultiplier: number,
    outgoingSoftCollisionForceLimit?: Vec3; // force magnitude limit in x,y,z directions
    incomingSoftCollisionForceMultiplier: number,
    maxClimbableHeight: number,
};
