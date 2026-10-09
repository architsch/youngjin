import PhysicsObject from "./physicsObject";

// A box of the room's space (see PHYSICS_VOXEL_SIZE_XZ) keeping the objects whose colliders reach into it,
// so those near a place are found without scanning the room. Far coarser than the room's voxels, whose
// blocks are looked up in the grid itself.
export default class PhysicsVoxel
{
    intersectingObjects: PhysicsObject[];

    constructor()
    {
        this.intersectingObjects = new Array<PhysicsObject>(4);
        this.intersectingObjects.length = 0;
    }
}
