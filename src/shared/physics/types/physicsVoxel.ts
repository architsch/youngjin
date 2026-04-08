import PhysicsObject from "./physicsObject";
import Voxel from "../../voxel/types/voxel";

export default class PhysicsVoxel
{
    voxel: Voxel;
    intersectingObjects: PhysicsObject[]; // The purpose of this is to let us quickly find out objects that fall within a specific region in space, without having to scan the entire room.

    constructor(voxel: Voxel)
    {
        this.voxel = voxel;
        this.intersectingObjects = new Array<PhysicsObject>(4);
        this.intersectingObjects.length = 0;
    }
}