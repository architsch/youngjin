import PhysicsObject from "./physicsObject";
import AABB2 from "../math/types/aabb2";

export default interface PhysicsVoxel
{
    row: number;
    col: number;
    collisionLayerMask: number;
    collisionShape: AABB2;
    intersectingObjects: PhysicsObject[];
}