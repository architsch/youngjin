import { COLLISION_LAYER_FLOOR_AND_CEILING, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../physics/types/collisionLayer";
import Room from "../../room/types/room";
import Voxel from "../types/voxel";

export function getVoxel(room: Room, row: number, col: number): Voxel
{
    const numGridCols = room.voxelGrid.numGridCols;
    const numGridRows = room.voxelGrid.numGridRows;
    if (row < 0 || row >= numGridRows || col < 0 || col >= numGridCols)
        throw new Error(`Voxel coordinates are out of range (row: ${row}, col: ${col})`);
    return room.voxelGrid.voxels[row * numGridCols + col];
}

export function isVoxelCollisionLayerOccupied(voxel: Voxel, collisionLayer: number): boolean
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return true;
    return (voxel.collisionLayerMask & (1 << collisionLayer)) != 0;
}

export function getVoxelQuad(voxel: Voxel, facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number): number
{
    return voxel.quads[getVoxelQuadIndex(voxel.collisionLayerMask, facingAxis, orientation, collisionLayer)];
}

export function getVoxelQuadIndex(collisionLayerMask: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
    collisionLayer: number): number
{
    return getFirstVoxelQuadIndexInLayer(collisionLayerMask, collisionLayer) +
        getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
}

export function getFirstVoxelQuadIndexInLayer(collisionLayerMask: number, collisionLayer: number): number
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        collisionLayer = COLLISION_LAYER_FLOOR_AND_CEILING;
    let startIndex = 0;
    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        startIndex += (((collisionLayerMask >> layer) & 1) != 0) ? 6 : 0;
    return startIndex;
}

export function getVoxelQuadIndexOffsetInsideLayer(facingAxis: "x" | "y" | "z", orientation: "-" | "+"): number
{
    return 2 * (facingAxis == "y" ? 0 : (facingAxis == "x" ? 1 : 2)) +
        (orientation == "-" ? 0 : 1);
}

export function getVoxelQuadFacingAxisFromQuadIndex(quadIndex: number): "x" | "y" | "z"
{
    const facingAxisCode = Math.floor((quadIndex % 6) * 0.5);
    return (facingAxisCode == 0 ? "y" : (facingAxisCode == 1 ? "x" : "z"));
}

export function getVoxelQuadOrientationFromQuadIndex(quadIndex: number): "-" | "+"
{
    return (quadIndex % 2 == 0) ? "-" : "+";
}

export function getVoxelQuadCollisionLayerFromQuadIndex(collisionLayerMask: number, quadIndex: number): number
{
    let collisionLayer = 0;
    let remainingCollisionLayerCount = Math.floor(quadIndex / 6);
    while (remainingCollisionLayerCount != 0)
    {
        if ((collisionLayerMask & 1) != 0)
            remainingCollisionLayerCount--;
        collisionLayer++;
        collisionLayerMask >>= 1;
    }
    return collisionLayer;
}