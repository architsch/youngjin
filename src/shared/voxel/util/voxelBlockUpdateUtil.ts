import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../physics/types/collisionLayer";
import Room from "../../room/types/room";
import { hideVoxelQuadTexture, setAndShowVoxelQuadTexture, showVoxelQuadTexture } from "./voxelQuadUpdateUtil";
import { getVoxel, getVoxelQuadIndexOffsetInsideLayer, isVoxelCollisionLayerOccupied } from "./voxelQueryUtil";

let debugEnabled = false;

export function setVoxelBlockUpdateUtilDebugEnabled(enabled: boolean)
{
    debugEnabled = enabled;
}

export function moveVoxelBlock(room: Room, row: number, col: number, collisionLayer: number,
    rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
{
    if (debugEnabled)
        console.log(`START - moveBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, rowOffset: ${rowOffset}, colOffset: ${colOffset}, collisionLayerOffset: ${collisionLayerOffset}`);

    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return false;
    }
    const quadTextureIndicesWithinLayer: number[] = Array.from(voxel.quads)
        .slice(6 * collisionLayer, 6 * (collisionLayer+1)) // Sample the quads within the given collisionLayer
        .map(quad => quad & 0b01111111); // Extract the textureIndex part from the quad

    const success = addVoxelBlock(room, row + rowOffset, col + colOffset, collisionLayer + collisionLayerOffset, quadTextureIndicesWithinLayer)
        && removeVoxelBlock(room, row, col, collisionLayer);

    if (debugEnabled)
        console.log(`END - moveBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, rowOffset: ${rowOffset}, colOffset: ${colOffset}, collisionLayerOffset: ${collisionLayerOffset}`);
    return success;
}

export function addVoxelBlock(room: Room, row: number, col: number, collisionLayer: number,
    quadTextureIndicesWithinLayer: number[]): boolean
{
    if (debugEnabled)
        console.log(`START - addBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, quadTextureIndicesWithinLayer: ${JSON.stringify(quadTextureIndicesWithinLayer)}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.error(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= room.voxelGrid.numGridRows-1 || col >= room.voxelGrid.numGridCols-1)
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

    if (!hideVoxelQuadTexture(voxel, "y", "+", collisionLayer-1))
        setAndShowVoxelQuadTexture(voxel, "y", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "-")]);
    
    if (!hideVoxelQuadTexture(voxel, "y", "+", collisionLayer+1))
        setAndShowVoxelQuadTexture(voxel, "y", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "+")]);

    if (!hideVoxelQuadTexture(getVoxel(room, row, col-1), "x", "+", collisionLayer))
        setAndShowVoxelQuadTexture(voxel, "x", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "-")]);

    if (!hideVoxelQuadTexture(getVoxel(room, row, col+1), "x", "-", collisionLayer))
        setAndShowVoxelQuadTexture(voxel, "x", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "+")]);

    if (!hideVoxelQuadTexture(getVoxel(room, row-1, col), "z", "+", collisionLayer))
        setAndShowVoxelQuadTexture(voxel, "z", "-", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "-")]);

    if (!hideVoxelQuadTexture(getVoxel(room, row+1, col), "z", "-", collisionLayer))
        setAndShowVoxelQuadTexture(voxel, "z", "+", collisionLayer, quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "+")]);

    if (debugEnabled)
        console.log(`END - addBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, quadTextureIndicesWithinLayer: ${JSON.stringify(quadTextureIndicesWithinLayer)}`);
    return true;
}

export function removeVoxelBlock(room: Room, row: number, col: number, collisionLayer: number): boolean
{
    if (debugEnabled)
        console.log(`START - removeBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.error(`collisionLayerNew is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
        return false;
    }
    if (row <= 0 || col <= 0 || row >= room.voxelGrid.numGridRows-1 || col >= room.voxelGrid.numGridCols-1)
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
    hideVoxelQuadTexture(voxel, "x", "-", collisionLayer);
    hideVoxelQuadTexture(voxel, "x", "+", collisionLayer);
    hideVoxelQuadTexture(voxel, "y", "-", collisionLayer);
    hideVoxelQuadTexture(voxel, "y", "+", collisionLayer);
    hideVoxelQuadTexture(voxel, "z", "-", collisionLayer);
    hideVoxelQuadTexture(voxel, "z", "+", collisionLayer);

    // Recover the adjacent block' quads that are newly exposed after the removal
    if (isVoxelCollisionLayerOccupied(voxel, collisionLayer+1))
        showVoxelQuadTexture(voxel, "y", "-", collisionLayer+1);
    if (isVoxelCollisionLayerOccupied(voxel, collisionLayer-1))
        showVoxelQuadTexture(voxel, "y", "+", collisionLayer-1);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row+1, col), collisionLayer))
        showVoxelQuadTexture(getVoxel(room, row+1, col), "z", "-", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row-1, col), collisionLayer))
        showVoxelQuadTexture(getVoxel(room, row-1, col), "z", "+", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row, col+1), collisionLayer))
        showVoxelQuadTexture(getVoxel(room, row, col+1), "x", "-", collisionLayer);
    if (isVoxelCollisionLayerOccupied(getVoxel(room, row, col-1), collisionLayer))
        showVoxelQuadTexture(getVoxel(room, row, col-1), "x", "+", collisionLayer);

    if (debugEnabled)
        console.log(`END - removeBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);
    return true;
}