import Room from "../../room/types/room";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";

export default interface PhysicsRoom
{
    room: Room;
    voxels: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };
}