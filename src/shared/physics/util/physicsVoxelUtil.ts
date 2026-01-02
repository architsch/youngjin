import AABB2 from "../../math/types/aabb2";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/constants";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsVoxel from "../types/physicsVoxel";

const voxelsTemp = new Array<PhysicsVoxel>();

export function getVoxelsInBox(physicsRoom: PhysicsRoom, box: AABB2): PhysicsVoxel[]
{
    voxelsTemp.length = 0;
    const row1 = Math.max(0, Math.floor(box.y - box.halfSizeY));
    const col1 = Math.max(0, Math.floor(box.x - box.halfSizeX));
    const row2 = Math.min(NUM_VOXEL_ROWS-1, Math.floor(box.y + box.halfSizeY));
    const col2 = Math.min(NUM_VOXEL_COLS-1, Math.floor(box.x + box.halfSizeX));
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
}