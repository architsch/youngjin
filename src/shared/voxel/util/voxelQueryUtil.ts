import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_GRID_COLS, NUM_GRID_ROWS, NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/constants";
import Room from "../../room/types/room";
import Voxel, { voxelQuadsBuffer } from "../types/voxel";

export function getVoxel(room: Room, row: number, col: number): Voxel
{
    if (row < 0 || row >= NUM_GRID_ROWS || col < 0 || col >= NUM_GRID_COLS)
        throw new Error(`Voxel coordinates are out of range (row: ${row}, col: ${col})`);
    return room.voxelGrid.voxels[row * NUM_GRID_COLS + col];
}

export function isVoxelCollisionLayerOccupied(voxel: Voxel, collisionLayer: number): boolean
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return true;
    return (voxel.collisionLayerMask & (1 << collisionLayer)) != 0;
}

//-------------------------------------------------------------------------------------
// Get quadIndex from properties
//-------------------------------------------------------------------------------------

export function getVoxelQuadIndex(row: number, col: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
    collisionLayer: number): number
{
    return getFirstVoxelQuadIndexInLayer(row, col, collisionLayer) +
        getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
}

export function getFirstVoxelQuadIndexInLayer(row: number, col: number, collisionLayer: number): number
{
    return getFirstVoxelQuadIndexInVoxel(row, col) +
        NUM_VOXEL_QUADS_PER_COLLISION_LAYER * collisionLayer;
}

export function getFirstVoxelQuadIndexInVoxel(row: number, col: number): number
{
    const voxelIndex = row * NUM_GRID_COLS + col;
    return NUM_VOXEL_QUADS_PER_VOXEL * voxelIndex;
}

export function getVoxelQuadIndexOffsetInsideLayer(facingAxis: "x" | "y" | "z", orientation: "-" | "+"): number
{
    return 2 * (facingAxis == "y" ? 0 : (facingAxis == "x" ? 1 : 2)) +
        (orientation == "-" ? 0 : 1);
}

//-------------------------------------------------------------------------------------
// Get properties from quadIndex
//-------------------------------------------------------------------------------------

export function getVoxelQuadFacingAxisFromQuadIndex(quadIndex: number): "x" | "y" | "z"
{
    const facingAxisCode = Math.floor(
        ((quadIndex % NUM_VOXEL_QUADS_PER_VOXEL) % NUM_VOXEL_QUADS_PER_COLLISION_LAYER) * 0.5
    );
    return (facingAxisCode == 0 ? "y" : (facingAxisCode == 1 ? "x" : "z"));
}

export function getVoxelQuadOrientationFromQuadIndex(quadIndex: number): "-" | "+"
{
    return (quadIndex % 2 == 0) ? "-" : "+";
}

export function getVoxelQuadCollisionLayerFromQuadIndex(quadIndex: number): number
{
    return Math.floor((quadIndex % NUM_VOXEL_QUADS_PER_VOXEL) / 6);
}

export function getVoxelRowFromQuadIndex(quadIndex: number): number
{
    const voxelIndex = Math.floor(quadIndex / NUM_VOXEL_QUADS_PER_VOXEL);
    return Math.floor(voxelIndex / NUM_GRID_COLS);
}

export function getVoxelColFromQuadIndex(quadIndex: number): number
{
    const voxelIndex = Math.floor(quadIndex / NUM_VOXEL_QUADS_PER_VOXEL);
    return voxelIndex % NUM_GRID_COLS;
}

//-------------------------------------------------------------------------------------
// Get transform dimensions from properties
//-------------------------------------------------------------------------------------

export function getVoxelQuadTransformDimensions(quadIndex: number)
    : { offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        scaleX: number, scaleY: number, scaleZ: number }
{
    const quad = voxelQuadsBuffer[quadIndex];
    if ((quad & 0b10000000) == 0) // quad is hidden
        return { offsetX: 0, offsetY: -9999, offsetZ: 0, dirX: 0, dirY: -1, dirZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

    const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let offsetX = 0, offsetY = 0, offsetZ = 0,
        dirX = 0, dirY = 0, dirZ = 0,
        scaleX = 1, scaleY = (facingAxis == "y") ? 1 : 0.5, scaleZ = 1;

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        offsetY = (orientation == "+") ? 0 : 4; // floor or ceiling
    }
    else
    {
        if (facingAxis == "y")
            offsetY = ((orientation == "-") ? 0 : 0.5) + 0.5 * collisionLayer;
        else
            offsetY = 0.25 + 0.5 * collisionLayer;
    }

    switch (facingAxis)
    {
        case "x":
            if (orientation == "+") { dirX = 1; dirY = 0; dirZ = 0; offsetX += 0.5; }
            else { dirX = -1; dirY = 0; dirZ = 0; offsetX -= 0.5; }
            break;
        case "y":
            if (orientation == "+") { dirX = 0; dirY = 1; dirZ = 0; }
            else { dirX = 0; dirY = -1; dirZ = 0; }
            break;
        case "z":
            if (orientation == "+") { dirX = 0; dirY = 0; dirZ = 1; offsetZ += 0.5; }
            else { dirX = 0; dirY = 0; dirZ = -1; offsetZ -= 0.5; }
            break;
        default:
            throw new Error(`Unknown facingAxis (${facingAxis})`);
    }
    return { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ };
}