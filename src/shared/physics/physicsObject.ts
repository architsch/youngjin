import PhysicsVoxel from "./physicsVoxel";
import Circle2 from "../math/types/circle2";

export default interface PhysicsObject
{
    objectId: string;
    collisionLayer: number;
    collisionShape: Circle2;
    intersectingVoxels: PhysicsVoxel[];
}