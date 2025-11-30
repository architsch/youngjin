import AABB2 from "../../math/types/aabb2";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsVoxel from "../types/physicsVoxel";

const voxelsTemp = new Array<PhysicsVoxel>();

export function getVoxelsInBox(room: PhysicsRoom, box: AABB2): PhysicsVoxel[]
{
    voxelsTemp.length = 0;
    const row1 = Math.max(0, Math.floor(box.y - box.halfSizeY));
    const col1 = Math.max(0, Math.floor(box.x - box.halfSizeX));
    const row2 = Math.min(room.numGridRows-1, Math.floor(box.y + box.halfSizeY));
    const col2 = Math.min(room.numGridCols-1, Math.floor(box.x + box.halfSizeX));
    for (let row = row1; row <= row2; ++row)
    {
        for (let col = col1; col <= col2; ++col)
        {
            const voxel = room.voxels[row * room.numGridCols + col];
            if (voxel != undefined)
                voxelsTemp.push(voxel);
            else
                console.error(`PhysicsVoxel is undefined (row = ${row}, col = ${col})`);
        }
    }
    return voxelsTemp;
}

export function addVoxelCollisionLayer(room: PhysicsRoom, row: number, col: number, collisionLayer: number)
{
    room.voxels[row * room.numGridCols + col].collisionLayerMask |= (1 << collisionLayer);
}

export function removeVoxelCollisionLayer(room: PhysicsRoom, row: number, col: number, collisionLayer: number)
{
    room.voxels[row * room.numGridCols + col].collisionLayerMask &= ~(1 << collisionLayer);
}

// Returns 1 if the layer exists, or 0 otherwise.
export function getVoxelCollisionLayer(room: PhysicsRoom, row: number, col: number, collisionLayer: number): number
{
    return (room.voxels[row * room.numGridCols + col].collisionLayerMask >> collisionLayer) & 1;
}