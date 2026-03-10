import AABB2 from "../../math/types/aabb2";
import { ColliderConfig } from "../../object/types/objectTypeConfig";

export type ColliderInfo = {
    hitbox: AABB2,
    level: number,
    collisionLayerMask: number,
    colliderConfig: ColliderConfig
};