import AABB3 from "../../math/types/aabb3";
import { ColliderConfig } from "./colliderConfig";

export type ColliderState = {
    hitbox: AABB3,
    colliderConfig: ColliderConfig
};