import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/constants";
import Room from "../../room/types/room";
import { hideVoxelQuad, showVoxelQuad } from "./voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadIndex, getVoxelQuadIndexOffsetInsideLayer, getVoxelRowFromQuadIndex, isVoxelCollisionLayerOccupied } from "./voxelQueryUtil";

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
        quadTextureIndicesWithinLayer.push(room.voxelGrid.quadsMem.quads[i] & 0b01111111);

    let newCollisionLayer = collisionLayer + collisionLayerOffset;
    if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
        newCollisionLayer = COLLISION_LAYER_NULL;

    const targetQuadIndex = getVoxelQuadIndex(row + rowOffset, col + colOffset, "y", "-",
        newCollisionLayer);
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
        console.warn(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= NUM_VOXEL_ROWS-1 || col >= NUM_VOXEL_COLS-1)
    {
        console.warn(`Cannot change a boundary voxel. (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
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

    let lowerCollisionLayer = collisionLayer-1;
    if (lowerCollisionLayer < COLLISION_LAYER_MIN)
        lowerCollisionLayer = COLLISION_LAYER_NULL;
    let upperCollisionLayer = collisionLayer+1;
    if (upperCollisionLayer > COLLISION_LAYER_MAX)
        upperCollisionLayer = COLLISION_LAYER_NULL;
    
    // (1) Hide quads that are concealed by the new block
    // (2) Show quads which comprise the exposed sides of the new block

    if (!hideVoxelQuad(voxel, "y", "+", lowerCollisionLayer))
        showVoxelQuad(voxel, "y", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "-")]);
    
    if (!hideVoxelQuad(voxel, "y", "-", upperCollisionLayer))
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
        console.warn(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= NUM_VOXEL_ROWS-1 || col >= NUM_VOXEL_COLS-1)
    {
        console.warn(`Cannot change a boundary voxel. (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return false;
    }

    let lowerCollisionLayer = collisionLayer-1;
    if (lowerCollisionLayer < COLLISION_LAYER_MIN)
        lowerCollisionLayer = COLLISION_LAYER_NULL;
    let upperCollisionLayer = collisionLayer+1;
    if (upperCollisionLayer > COLLISION_LAYER_MAX)
        upperCollisionLayer = COLLISION_LAYER_NULL;

    // Hide the removed block's quads
    hideVoxelQuad(voxel, "x", "-", collisionLayer);
    hideVoxelQuad(voxel, "x", "+", collisionLayer);
    hideVoxelQuad(voxel, "y", "-", collisionLayer);
    hideVoxelQuad(voxel, "y", "+", collisionLayer);
    hideVoxelQuad(voxel, "z", "-", collisionLayer);
    hideVoxelQuad(voxel, "z", "+", collisionLayer);

    // Recover the adjacent block' quads that are newly exposed after the removal
    if (isVoxelCollisionLayerOccupied(voxel, upperCollisionLayer))
        showVoxelQuad(voxel, "y", "-", upperCollisionLayer);
    if (isVoxelCollisionLayerOccupied(voxel, lowerCollisionLayer))
        showVoxelQuad(voxel, "y", "+", lowerCollisionLayer);
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