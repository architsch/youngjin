import PhysicsObject from "./physicsObject";
import AABB2 from "../../math/types/aabb2";
import Voxel from "../../voxel/types/voxel";

export default class PhysicsVoxel
{
    voxel: Voxel;
    hitbox: AABB2;
    intersectingObjects: PhysicsObject[]; // The purpose of this is to let us quickly find out objects that fall within a specific region in space, without having to scan the entire room.

    constructor(voxel: Voxel)
    {
        this.voxel = voxel;

        const row = voxel.row;
        const col = voxel.col;
        this.hitbox = {x: col+0.5, y: row+0.5, halfSizeX: 0.5, halfSizeY: 0.5};

        this.intersectingObjects = new Array<PhysicsObject>(4);
        this.intersectingObjects.length = 0;
    }
}