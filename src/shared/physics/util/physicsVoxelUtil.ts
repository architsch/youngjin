import AABB3 from "../../math/types/aabb3";
import { NUM_PHYSICS_VOXELS_X, NUM_PHYSICS_VOXELS_Y, NUM_PHYSICS_VOXELS_Z, PHYSICS_VOXEL_SIZE_XZ,
    PHYSICS_VOXEL_SIZE_Y } from "../../system/sharedConstants";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsVoxel from "../types/physicsVoxel";

const voxelsTemp = new Array<PhysicsVoxel>();

const PhysicsVoxelUtil =
{
    // A room's physics voxels, none holding anything yet.
    createVoxels: (): PhysicsVoxel[] =>
    {
        return Array.from({length: NUM_PHYSICS_VOXELS_X * NUM_PHYSICS_VOXELS_Y * NUM_PHYSICS_VOXELS_Z},
            () => new PhysicsVoxel());
    },

    // The physics voxels a box reaches into. What lies beyond the room counts as in the nearest ones, so
    // no box is ever in none. The array is shared: it holds the latest call's answer.
    getVoxelsInBox: (physicsRoom: PhysicsRoom, box: AABB3): PhysicsVoxel[] =>
    {
        voxelsTemp.length = 0;
        const x1 = toIndex(box.center.x - box.halfSize.x, PHYSICS_VOXEL_SIZE_XZ, NUM_PHYSICS_VOXELS_X);
        const x2 = toIndex(box.center.x + box.halfSize.x, PHYSICS_VOXEL_SIZE_XZ, NUM_PHYSICS_VOXELS_X);
        const y1 = toIndex(box.center.y - box.halfSize.y, PHYSICS_VOXEL_SIZE_Y, NUM_PHYSICS_VOXELS_Y);
        const y2 = toIndex(box.center.y + box.halfSize.y, PHYSICS_VOXEL_SIZE_Y, NUM_PHYSICS_VOXELS_Y);
        const z1 = toIndex(box.center.z - box.halfSize.z, PHYSICS_VOXEL_SIZE_XZ, NUM_PHYSICS_VOXELS_Z);
        const z2 = toIndex(box.center.z + box.halfSize.z, PHYSICS_VOXEL_SIZE_XZ, NUM_PHYSICS_VOXELS_Z);
        for (let z = z1; z <= z2; ++z)
        {
            for (let x = x1; x <= x2; ++x)
            {
                for (let y = y1; y <= y2; ++y)
                    voxelsTemp.push(physicsRoom.voxels[(z * NUM_PHYSICS_VOXELS_X + x) * NUM_PHYSICS_VOXELS_Y + y]);
            }
        }
        return voxelsTemp;
    },
}

function toIndex(coord: number, size: number, count: number): number
{
    return Math.max(0, Math.min(count - 1, Math.floor(coord / size)));
}

export default PhysicsVoxelUtil;
