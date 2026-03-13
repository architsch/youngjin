import Room from "../../room/types/room";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";

export default class PhysicsRoom
{
    room: Room;
    voxels: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };

    constructor(room: Room)
    {
        this.room = room;
        this.voxels = room.voxelGrid.voxels.map(voxel => new PhysicsVoxel(voxel));
        this.objectById = {};
    }
}