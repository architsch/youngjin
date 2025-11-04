import PhysicsVoxel from "./physicsVoxel";
import AABB2 from "../../math/types/aabb2";

export default interface PhysicsObject
{
    objectId: string;
    collisionLayer: number;
    hitbox: AABB2;
    intersectingVoxels: PhysicsVoxel[];
}