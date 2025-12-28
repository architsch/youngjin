import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../physics/types/collisionLayer";
import Voxel from "../types/voxel";
import VoxelQuadChange from "../types/voxelQuadChange";
import { getVoxelQuad, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex, isVoxelCollisionLayerOccupied } from "./voxelQueryUtil";

let debugEnabled = false;
const recentChanges: VoxelQuadChange[] = [];

export function setVoxelQuadUpdateUtilDebugEnabled(enabled: boolean)
{
    debugEnabled = enabled;
}

export function getRecentVoxelQuadChanges(): VoxelQuadChange[]
{
    return recentChanges;
}

export function flushRecentVoxelQuadChanges()
{
    recentChanges.length = 0;
}

export function setAndShowVoxelQuadTexture(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number,
    shouldPushChange: boolean = true): boolean
{
    const quad = getVoxelQuad(voxel, facingAxis, orientation, collisionLayer);
    const quadNew = (textureIndex & 0b01111111) | 0b10000000;
    const changed = quad != quadNew;
    if (changed)
        setVoxelQuad(voxel, facingAxis, orientation, collisionLayer, quadNew, shouldPushChange);
    return changed;
}

export function setVoxelQuadTexture(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number,
    shouldPushChange: boolean = true): boolean
{
    const quad = getVoxelQuad(voxel, facingAxis, orientation, collisionLayer);
    const quadNew = (textureIndex & 0b01111111) | (quad & 0b10000000);
    const changed = quad != quadNew;
    if (changed)
        setVoxelQuad(voxel, facingAxis, orientation, collisionLayer, quadNew, shouldPushChange);
    return changed;
}

export function showVoxelQuadTexture(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    shouldPushChange: boolean = true): boolean
{
    const quad = getVoxelQuad(voxel, facingAxis, orientation, collisionLayer);
    const quadNew = quad | 0b10000000;
    const changed = quad != quadNew;
    if (changed)
        setVoxelQuad(voxel, facingAxis, orientation, collisionLayer, quadNew, shouldPushChange);
    return changed;
}

export function hideVoxelQuadTexture(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    shouldPushChange: boolean = true): boolean
{
    const quad = getVoxelQuad(voxel, facingAxis, orientation, collisionLayer);
    const quadNew = quad & 0b01111111;
    const changed = quad != quadNew;
    if (changed)
        setVoxelQuad(voxel, facingAxis, orientation, collisionLayer, quadNew, shouldPushChange);
    return changed;
}

function setVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number, newQuad: number,
    shouldPushChange: boolean)
{
    const quadIndex = getVoxelQuadIndex(voxel.collisionLayerMask, facingAxis, orientation, collisionLayer);
    const showQuad = (newQuad & 0b10000000) != 0;
    const layerOccupied = isVoxelCollisionLayerOccupied(voxel, collisionLayer);
    if (showQuad && !layerOccupied &&
        collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
    {
        addVoxelCollisionLayer(voxel, collisionLayer);
    }
    else if (!showQuad && layerOccupied &&
        collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
    {
        let numLeftoverQuads = 0;
        const layerStartByteIndex = 6 * collisionLayer; // Each layer consists of 6 quads (bytes)
        for (let i = layerStartByteIndex; i < layerStartByteIndex + 6; ++i)
            numLeftoverQuads += (i != quadIndex && (voxel.quads[i] & 0b10000000) != 0) ? 1 : 0;
        if (numLeftoverQuads == 0)
            removeVoxelCollisionLayer(voxel, collisionLayer);
    }
    
    voxel.quads[quadIndex] = newQuad;

    if (shouldPushChange)
        pushChange(voxel, new VoxelQuadChange(voxel.row, voxel.col, voxel.collisionLayerMask, quadIndex, newQuad));
}

function pushChange(voxel: Voxel, change: VoxelQuadChange)
{
    if (debugEnabled)
    {
        const snapshot: string[] = Array.from(voxel.quads)
            .filter((quad: number) => {
                return (quad & 0b10000000) != 0;
            }).map((quad: number, quadIndex: number) => {
                const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
                const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
                const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(voxel.collisionLayerMask, quadIndex);
                const showQuad = (quad & 0b10000000) != 0;
                const textureIndex = quad & 0b01111111;
                return `${orientation}${facingAxis}.${collisionLayer} (${showQuad ? "show" : "hide"} ${textureIndex})`;
            });
        change.voxelQuadsResultSnapshot = snapshot;
    }
    recentChanges.push(change);
}

function addVoxelCollisionLayer(voxel: Voxel, collisionLayer: number)
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        throw new Error(`Collision layer is out of bound (collisionLayer = ${collisionLayer})`);
    voxel.collisionLayerMask |= (1 << collisionLayer);

    const layerStartByteIndex = 6 * collisionLayer; // Each layer consists of 6 quads (bytes)
    const newQuads = new Uint8Array(voxel.quads.length + 6);
    for (let i = 0; i < layerStartByteIndex; ++i) // Left side of the insertion
        newQuads[i] = voxel.quads[i];
    for (let i = layerStartByteIndex; i < layerStartByteIndex + 6; ++i) // Inserted quads
        newQuads[i] = 0; // Initially, all quads in a new layer are hidden and have the texture index of 0.
    for (let i = layerStartByteIndex + 6; i < newQuads.length; ++i) // Right side of the insertion
        newQuads[i] = voxel.quads[i - 6];
    voxel.quads = newQuads;
}

function removeVoxelCollisionLayer(voxel: Voxel, collisionLayer: number)
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        throw new Error(`Collision layer is out of bound (collisionLayer = ${collisionLayer})`);
    voxel.collisionLayerMask &= ~(1 << collisionLayer);

    const layerStartByteIndex = 6 * collisionLayer; // Each layer consists of 6 quads (bytes)
    const newQuads = new Uint8Array(voxel.quads.length - 6);
    for (let i = 0; i < layerStartByteIndex; ++i) // Left side of the removal
        newQuads[i] = voxel.quads[i];
    for (let i = layerStartByteIndex; i < newQuads.length; ++i) // Right side of the removal
        newQuads[i] = voxel.quads[i + 6];
    voxel.quads = newQuads;
}