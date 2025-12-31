import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/constants";
import Voxel, { voxelQuadsBuffer } from "../types/voxel";
import VoxelQuadChange from "../types/voxelQuadChange";
import { getFirstVoxelQuadIndexInLayer, getVoxelQuadIndex } from "./voxelQueryUtil";

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

export function showVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number = -1, // -1 if textureIndex stays the same as before
    shouldPushChange: boolean = true): boolean
{
    const quadIndex = getVoxelQuadIndex(voxel.row, voxel.col, facingAxis, orientation, collisionLayer);
    const oldQuad = voxelQuadsBuffer[quadIndex];
    const newTextureIndex = (textureIndex >= 0) ? textureIndex : (oldQuad & 0b01111111);
    const newQuad = (newTextureIndex & 0b01111111) | 0b10000000;
    return setVoxelQuad(voxel, quadIndex, oldQuad, newQuad, collisionLayer, shouldPushChange);
}

export function hideVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    shouldPushChange: boolean = true): boolean
{
    const quadIndex = getVoxelQuadIndex(voxel.row, voxel.col, facingAxis, orientation, collisionLayer);
    const oldQuad = voxelQuadsBuffer[quadIndex];
    return setVoxelQuad(voxel, quadIndex, oldQuad, 0, collisionLayer, shouldPushChange);
}

function setVoxelQuad(voxel: Voxel, quadIndex: number, oldQuad: number, newQuad: number,
    collisionLayer: number, shouldPushChange: boolean): boolean
{
    if (newQuad == oldQuad)
        return false; // no change

    const showQuadOld = (oldQuad & 0b10000000) != 0;
    const showQuadNew = (newQuad & 0b10000000) != 0;

    voxelQuadsBuffer[quadIndex] = newQuad;

    if (collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
    {
        if (!showQuadOld && showQuadNew)
        {
            voxel.collisionLayerMask |= (1 << collisionLayer);
        }
        else if (showQuadOld && !showQuadNew)
        {
            // If there is no quad shown in the layer, deactivate that layer.
            let quadCount = 0;
            const startIndex = getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
            for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
                quadCount += ((voxelQuadsBuffer[i] & 0b10000000) != 0) ? 1 : 0;
            if (quadCount == 0)
                voxel.collisionLayerMask &= ~(1 << collisionLayer);
        }
    }

    if (shouldPushChange)
        pushChange(voxel, new VoxelQuadChange(quadIndex, newQuad));
    return true;
}

function pushChange(voxel: Voxel, change: VoxelQuadChange)
{
    if (debugEnabled)
        change.voxelQuadsResultSnapshot = String(voxel);
    recentChanges.push(change);
}