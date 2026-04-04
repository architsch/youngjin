import PhysicsVoxel from "./physicsVoxel";
import { ColliderState } from "./colliderState";
import PhysicsRoom from "./physicsRoom";
import PhysicsVoxelUtil from "../util/physicsVoxelUtil";

export default class PhysicsObject
{
    physicsRoom: PhysicsRoom;
    objectId: string;
    objectTypeIndex: number;
    colliderState: ColliderState;
    intersectingVoxels: PhysicsVoxel[]; // The purpose of this is to let the object remember from which voxels it must unregister itself when leaving them.

    constructor(physicsRoom: PhysicsRoom, objectId: string, objectTypeIndex: number, colliderState: ColliderState)
    {
        this.physicsRoom = physicsRoom;
        this.objectId = objectId;
        this.objectTypeIndex = objectTypeIndex;
        this.colliderState = colliderState;
        this.intersectingVoxels = new Array<PhysicsVoxel>(4);
        this.intersectingVoxels.length = 0;
        
        this.addToIntersectingVoxels();
    }

    onDestroy()
    {
        this.removeFromIntersectingVoxels();
    }

    removeFromIntersectingVoxels()
    {
        for (const voxel of PhysicsVoxelUtil.getVoxelsInBox(this.physicsRoom, this.colliderState.hitbox))
        {
            const objs = voxel.intersectingObjects;
            for (let i = 0; i < objs.length; ++i)
            {
                const obj = objs[i];
                if (obj.objectId == this.objectId)
                {
                    for (let j = i+1; j < objs.length; ++j)
                        objs[i] = objs[j];
                    --objs.length;
                    break;
                }
            }
        }
    }

    addToIntersectingVoxels()
    {
        const voxels = PhysicsVoxelUtil.getVoxelsInBox(this.physicsRoom, this.colliderState.hitbox);
        for (const voxel of voxels)
            voxel.intersectingObjects.push(this);
    }
}