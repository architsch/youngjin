import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/constants";
import Room from "../../room/types/room";
import { setVoxelQuadVisible } from "./voxelQuadUpdateUtil";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadIndexOffsetInsideLayer, getVoxelRowFromQuadIndex, isVoxelCollisionLayerOccupied } from "./voxelQueryUtil";
import Voxel from "../types/voxel";

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
    /*const xShrink = (voxel.xShrinkMask & (1 << collisionLayer)) != 0;
    const zShrink = (voxel.zShrinkMask & (1 << collisionLayer)) != 0;*/

    const quadTextureIndicesWithinLayer: number[] = [];
    const startIndex = getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer.push(room.voxelGrid.quadsMem.quads[i] & 0b01111111);

    let newCollisionLayer = collisionLayer + collisionLayerOffset;
    if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
        newCollisionLayer = COLLISION_LAYER_NULL;

    const targetQuadIndex = getVoxelQuadIndex(row + rowOffset, col + colOffset, "y", "-",
        newCollisionLayer);
    const success = addVoxelBlock(room, targetQuadIndex, /*xShrink, zShrink,*/ quadTextureIndicesWithinLayer)
        && removeVoxelBlock(room, quadIndex);

    if (debugEnabled)
        console.log(`END - moveBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, rowOffset: ${rowOffset}, colOffset: ${colOffset}, collisionLayerOffset: ${collisionLayerOffset}`);
    return success;
}

export function addVoxelBlock(room: Room, quadIndex: number, /*xShrink: boolean, zShrink: boolean,*/
    quadTextureIndicesWithinLayer: number[]): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (debugEnabled)
        console.log(`START - addBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}, quadTextureIndicesWithinLayer: ${JSON.stringify(quadTextureIndicesWithinLayer)}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.warn(`collisionLayer is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
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
        console.error(`Voxel block already exists (row: ${row}, col: ${col}, collisionLayer: ${collisionLayer})`);
        return false;
    }
    voxel.collisionLayerMask ^= (1 << collisionLayer);

    /*if (xShrink)
        voxel.xShrinkMask |= (1 << collisionLayer);
    else
        voxel.xShrinkMask &= ~(1 << collisionLayer);

    if (zShrink)
        voxel.zShrinkMask |= (1 << collisionLayer);
    else
        voxel.zShrinkMask &= ~(1 << collisionLayer);*/
    
    updateAllVoxelBlockSides(room, voxel, collisionLayer, quadTextureIndicesWithinLayer);

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
        console.warn(`collisionLayer is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
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
    if (!isVoxelCollisionLayerOccupied(voxel, collisionLayer))
    {
        console.error(`No voxel block to remove (row: ${row}, col: ${col}, collisionLayer: ${collisionLayer})`);
        return false;
    }
    voxel.collisionLayerMask ^= (1 << collisionLayer);

    updateAllVoxelBlockSides(room, voxel, collisionLayer);

    if (debugEnabled)
        console.log(`END - removeBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);
    return true;
}

/*export function shrinkOrExpandVoxelBlock(room: Room, quadIndex: number): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);

    if (debugEnabled)
        console.log(`START - shrinkOrExpandVoxelBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        console.warn(`collisionLayer is out of range (row: ${row}, col: ${col}, collisionLayer = ${collisionLayer})`);
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

    switch (facingAxis)
    {
        case "y":
            if ((voxel.xShrinkMask & (1 << collisionLayer)) != (voxel.zShrinkMask & (1 << collisionLayer)))
            {
                voxel.xShrinkMask |= (1 << collisionLayer);
                voxel.zShrinkMask |= (1 << collisionLayer);
            }
            else
            {
                voxel.xShrinkMask ^= (1 << collisionLayer);
                voxel.zShrinkMask ^= (1 << collisionLayer);
            }
            break;
        case "x":
            voxel.zShrinkMask ^= (1 << collisionLayer);
            break;
        case "z":
            voxel.xShrinkMask ^= (1 << collisionLayer);
            break;
    }
    updateAllVoxelBlockSides(room, voxel, collisionLayer);

    if (debugEnabled)
        console.log(`END - shrinkOrExpandVoxelBlock - row: ${row}, col: ${col}, collisionLayer: ${collisionLayer}`);
    return true;
}*/

function updateAllVoxelBlockSides(room: Room, voxel: Voxel, collisionLayer: number,
    quadTextureIndicesWithinLayer?: number[])
{
    let lowerCollisionLayer = collisionLayer-1;
    if (lowerCollisionLayer < COLLISION_LAYER_MIN)
        lowerCollisionLayer = COLLISION_LAYER_NULL;
    let upperCollisionLayer = collisionLayer+1;
    if (upperCollisionLayer > COLLISION_LAYER_MAX)
        upperCollisionLayer = COLLISION_LAYER_NULL;

    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("y", "+")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("x", "+")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[getVoxelQuadIndexOffsetInsideLayer("z", "+")] : undefined);
}

function updateVoxelBlockSide(room: Room, voxel: Voxel, collisionLayer: number, lowerCollisionLayer: number, upperCollisionLayer: number,
    facingAxis: "x" | "y" | "z", outOrientation: "-" | "+", quadTextureIndicesWithinLayer: number = -1)
{
    let adjBlockVoxel = voxel;
    let adjBlockCollisionLayer = collisionLayer;
    
    switch (facingAxis)
    {
        case "y":
            adjBlockCollisionLayer = (outOrientation == "-" ? lowerCollisionLayer : upperCollisionLayer);
            break;
        case "x":
            adjBlockVoxel = getVoxel(room, voxel.row, voxel.col + (outOrientation == "-" ? -1 : 1));
            break;
        case "z":
            adjBlockVoxel = getVoxel(room, voxel.row + (outOrientation == "-" ? -1 : 1), voxel.col);
            break;
    }

    const myBlockOccupied = isVoxelCollisionLayerOccupied(voxel, collisionLayer);
    /*const myBlockXShrink = (voxel.xShrinkMask & (1 << collisionLayer)) != 0;
    const myBlockZShrink = (voxel.zShrinkMask & (1 << collisionLayer)) != 0;*/

    const adjBlockOccupied = isVoxelCollisionLayerOccupied(adjBlockVoxel, adjBlockCollisionLayer);
    /*const adjBlockXShrink = (adjBlockCollisionLayer == COLLISION_LAYER_NULL)
        ? false : ((adjBlockVoxel.xShrinkMask & (1 << adjBlockCollisionLayer)) != 0);
    const adjBlockZShrink = (adjBlockCollisionLayer == COLLISION_LAYER_NULL)
        ? false : ((adjBlockVoxel.zShrinkMask & (1 << adjBlockCollisionLayer)) != 0);*/

    const showMyQuad = myBlockOccupied && !adjBlockOccupied;
    const showAdjQuad = adjBlockOccupied && !myBlockOccupied;
    /*let showMyQuad: boolean;
    let showAdjQuad: boolean;

    switch (facingAxis)
    {
        case "y":
            showMyQuad = myBlockOccupied && (!adjBlockOccupied ||
                (!myBlockXShrink && adjBlockXShrink) || // Block is partially exposed
                (!myBlockZShrink && adjBlockZShrink) // Block is partially exposed
            );
            showAdjQuad = adjBlockOccupied && (!myBlockOccupied ||
                (!adjBlockXShrink && myBlockXShrink) || // Block is partially exposed
                (!adjBlockZShrink && myBlockZShrink) // Block is partially exposed
            );
            break;
        case "x":
            showMyQuad = myBlockOccupied && (!adjBlockOccupied ||
                (adjBlockXShrink || myBlockXShrink) || // There is a gap between the two blocks
                (!myBlockZShrink && adjBlockZShrink) // Block is partially exposed
            );
            showAdjQuad = adjBlockOccupied && (!myBlockOccupied ||
                (myBlockXShrink || adjBlockXShrink) || // There is a gap between the two blocks
                (!adjBlockZShrink && myBlockZShrink) // Block is partially exposed
            );
            break;
        case "z":
            showMyQuad = myBlockOccupied && (!adjBlockOccupied ||
                (adjBlockZShrink || myBlockZShrink) || // There is a gap between the two blocks
                (!myBlockXShrink && adjBlockXShrink) // Block is partially exposed
            );
            showAdjQuad = adjBlockOccupied && (!myBlockOccupied ||
                (myBlockZShrink || adjBlockZShrink) || // There is a gap between the two blocks
                (!adjBlockXShrink && myBlockXShrink) // Block is partially exposed
            );
            break;
    }*/

    setVoxelQuadVisible(showMyQuad, voxel, facingAxis, outOrientation,
        collisionLayer, quadTextureIndicesWithinLayer);
    setVoxelQuadVisible(showAdjQuad, adjBlockVoxel, facingAxis, outOrientation == "-" ? "+" : "-",
        adjBlockCollisionLayer);
}