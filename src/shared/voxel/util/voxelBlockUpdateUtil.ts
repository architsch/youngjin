import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_GRID_COLS, NUM_GRID_ROWS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/constants";
import Room from "../../room/types/room";
import { hideVoxelQuad, showVoxelQuad } from "./voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadIndex, getVoxelQuadIndexOffsetInsideLayer, getVoxelRowFromQuadIndex, isVoxelCollisionLayerOccupied } from "./voxelQueryUtil";
import { voxelQuadsBuffer } from "../types/voxel";

let debugEnabled = false;

export function setVoxelBlockUpdateUtilDebugEnabled(enabled: boolean)
{
    debugEnabled = enabled;
}

export function moveVoxelBlock(room: Room, quadIndex: number,
    rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (debugEnabled)
        console.log(`START - moveBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, rowOffset: ${rowOffset}, colOffset: ${colOffset}, collisionLayerOffset: ${collisionLayerOffset}`);

    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return false;
    }
    const quadTextureIndicesWithinLayer: number[] = [];
    const startIndex = getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer.push(voxelQuadsBuffer[i] & 0b01111111);

    const targetQuadIndex = getVoxelQuadIndex(row + rowOffset, col + colOffset, "y", "-",
        collisionLayer + collisionLayerOffset);
    const success = addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer)
        && removeVoxelBlock(room, quadIndex);

    if (debugEnabled)
        console.log(`END - moveBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, rowOffset: ${rowOffset}, colOffset: ${colOffset}, collisionLayerOffset: ${collisionLayerOffset}`);
    return success;
}

export function addVoxelBlock(room: Room, quadIndex: number,
    quadTextureIndicesWithinLayer: number[]): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (debugEnabled)
        console.log(`START - addBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, quadTextureIndicesWithinLayer: ${JSON.stringify(quadTextureIndicesWithinLayer)}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.error(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= NUM_GRID_ROWS-1 || col >= NUM_GRID_COLS-1)
    {
        console.error(`Cannot change a boundary voxel. (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return false;
    }
    if (isVoxelCollisionLayerOccupied(voxel, collisionLayer))
    {
        if (debugEnabled)
            console.warn("Block's position is already occupied.");
        return false;
    }
    
    // (1) Hide quads that are concealed by the new block
    // (2) Show quads which comprise the exposed sides of the new block

    if (!hideVoxelQuad(voxel, "y", "+", collisionLayer-1))
        showVoxelQuad(voxel, "y", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "-")]);
    
    if (!hideVoxelQuad(voxel, "y", "+", collisionLayer+1))
        showVoxelQuad(voxel, "y", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "+")]);

    if (!hideVoxelQuad(getVoxel(room, row, col-1), "x", "+", collisionLayer))
        showVoxelQuad(voxel, "x", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "-")]);

    if (!hideVoxelQuad(getVoxel(room, row, col+1), "x", "-", collisionLayer))
        showVoxelQuad(voxel, "x", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "+")]);

    if (!hideVoxelQuad(getVoxel(room, row-1, col), "z", "+", collisionLayer))
        showVoxelQuad(voxel, "z", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "-")]);

    if (!hideVoxelQuad(getVoxel(room, row+1, col), "z", "-", collisionLayer))
        showVoxelQuad(voxel, "z", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "+")]);

    if (debugEnabled)
        console.log(`END - addBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, quadTextureIndicesWithinLayer: ${JSON.stringify(quadTextureIndicesWithinLayer)}`);
    return true;
}

export function removeVoxelBlock(room: Room, quadIndex: number): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (debugEnabled)
        console.log(`START - removeBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.error(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= NUM_GRID_ROWS-1 || col >= NUM_GRID_COLS-1)
    {
        console.error(`Cannot change a boundary voxel. (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return false;
    }

    // Hide the removed block's quads
    hideVoxelQuad(voxel, "x", "-", collisionLayer);
    hideVoxelQuad(voxel, "x", "+", collisionLayer);
    hideVoxelQuad(voxel, "y", "-", collisionLayer);
    hideVoxelQuad(voxel, "y", "+", collisionLayer);
    hideVoxelQuad(voxel, "z", "-", collisionLayer);
    hideVoxelQuad(voxel, "z", "+", collisionLayer);

    // Recover the adjacent block' quads that are newly exposed after the removal
    if (isVoxelCollisionLayerOccupied(voxel, collisionLayer+1))
        showVoxelQuad(voxel, "y", "-", collisionLayer+1);
    if (isVoxelCollisionLayerOccupied(voxel, collisionLayer-1))
        showVoxelQuad(voxel, "y", "+", collisionLayer-1);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row+1, col), collisionLayer))
        showVoxelQuad(getVoxel(room, row+1, col), "z", "-", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row-1, col), collisionLayer))
        showVoxelQuad(getVoxel(room, row-1, col), "z", "+", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row, col+1), collisionLayer))
        showVoxelQuad(getVoxel(room, row, col+1), "x", "-", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row, col-1), collisionLayer))
        showVoxelQuad(getVoxel(room, row, col-1), "x", "+", collisionLayer);

    if (debugEnabled)
        console.log(`END - removeBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);
    return true;
}