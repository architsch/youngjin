import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";

export default interface PhysicsRoom
{
    numGridRows: number;
    numGridCols: number;
    voxelGrid: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };
}