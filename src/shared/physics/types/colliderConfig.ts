import Vec3 from "../../math/types/vec3";
import { HitboxSize } from "./hitboxSize";

// How a collider takes part in physics. Whether its object is driven by physics is the type's Rigidbody
// component; whether it is fixed to a surface is the type's attachment (see ObjectTypeConfig).
export type ColliderConfig = {
    baseHitboxSize: HitboxSize, // The footprint at unit scale; an object's own is this times its scale.
    // What a sphere meets it as (see PhysicsSphereUtil): a box if absent. A sphere fills its hitbox, as wide every way as
    // that is along x. A cylinder stands upright in its hitbox, as wide as that is along x and as tall. To everything
    // else it is its hitbox.
    shape?: "box" | "sphere" | "cylinder",
    // Whether a sphere that strikes it bounces off it rather than ends there: off a cylinder, or a solid box
    // (applyHardCollisionToOthers), as off its surface where the two touch; off any other box as off the face it is
    // turned to show, whichever part of it the sphere touches.
    bouncesSpheres?: boolean,
    applyHardCollisionToOthers: boolean,
    outgoingSoftCollisionForceMultiplier: number,
    outgoingSoftCollisionForceLimit?: Vec3; // force magnitude limit in x,y,z directions
    incomingSoftCollisionForceMultiplier: number,
    maxClimbableHeight: number,
};
