import AABB3 from "../../math/types/aabb3";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsVoxel from "../types/physicsVoxel";

const voxelsTemp = new Array<PhysicsVoxel>();

const PhysicsVoxelUtil =
{
    // Returns all voxels that the given AABB3's XZ footprint overlaps with.
    getVoxelsInBox: (physicsRoom: PhysicsRoom, box: AABB3): PhysicsVoxel[] =>
    {
        voxelsTemp.length = 0;
        const row1 = Math.max(0, Math.floor(box.center.z - box.halfSize.z));
        const col1 = Math.max(0, Math.floor(box.center.x - box.halfSize.x));
        const row2 = Math.min(NUM_VOXEL_ROWS-1, Math.floor(box.center.z + box.halfSize.z));
        const col2 = Math.min(NUM_VOXEL_COLS-1, Math.floor(box.center.x + box.halfSize.x));
        for (let row = row1; row <= row2; ++row)
        {
            for (let col = col1; col <= col2; ++col)
            {
                const voxel = physicsRoom.voxels[row * NUM_VOXEL_COLS + col];
                if (voxel != undefined)
                    voxelsTemp.push(voxel);
                else
                    console.error(`PhysicsVoxel is undefined (row = ${row}, col = ${col})`);
            }
        }
        return voxelsTemp;
    },
}

export default PhysicsVoxelUtil;