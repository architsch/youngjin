import PhysicsObject from "./physicsObject";
import AABB2 from "../../math/types/aabb2";
import Voxel from "../../voxel/types/voxel";

export default interface PhysicsVoxel
{
    voxel: Voxel;
    hitbox: AABB2;
    intersectingObjects: PhysicsObject[]; // The purpose of this is to let us quickly find out objects that fall within a specific region in space, without having to scan the entire room.
}