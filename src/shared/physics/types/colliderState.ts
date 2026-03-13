import AABB2 from "../../math/types/aabb2";
import { ColliderConfig } from "./colliderConfig";

export type ColliderState = {
    hitbox: AABB2,
    level: number,
    collisionLayerMask: number,
    colliderConfig: ColliderConfig
};