import PhysicsObject from "./physicsObject";
import AABB2 from "../../math/types/aabb2";
import Voxel from "../../voxel/types/voxel";

export default interface PhysicsVoxel
{
    voxel: Voxel;
    hitbox: AABB2;
    intersectingObjects: PhysicsObject[];
}