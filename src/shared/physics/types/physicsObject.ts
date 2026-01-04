import PhysicsVoxel from "./physicsVoxel";
import AABB2 from "../../math/types/aabb2";

export default interface PhysicsObject
{
    objectId: string;
    collisionLayerMaskAtGroundLevel: number; // 8-bit binary mask
    level: number; // 0 = ground level
    lastLevelChangeTime: number;
    hitbox: AABB2;
    intersectingVoxels: PhysicsVoxel[];
}