import * as THREE from "three";
import App from "../../app";
import InstancedMeshGraphics from "../../object/components/instancedMeshGraphics";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import VoxelQuadInstanceUtil from "./voxelQuadInstanceUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NEAR_EPSILON,
    NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID } from "../../../shared/system/sharedConstants";

// Queries about the room as drawn (vs. VoxelQueryUtil's stored grid): blocks hidden by the orbit camera
// are still solid but not visible (see OrbitOcclusionHider). Always about the single current room.

// The voxel mesh (quad index = instance id).
const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

// Upper bound on walk steps, guarding against degenerate segments.
const maxGridWalkSteps = NUM_VOXEL_ROWS + NUM_VOXEL_COLS + NUM_COLLISION_LAYERS + 3;

// Reach for the open-space measure (see getOpenSpaceDropAhead).
const openSpaceReach = 5; // in world units

const blockCenterTemp = new THREE.Vector3();

const ClientVoxelQueryUtil =
{
    getVoxelInstancedMeshId(): string
    {
        return voxelInstancedMeshId;
    },

    // Whether drawn room geometry lies between two points. Walks blocks along the segment (raycasting
    // the voxel mesh would test every instance). Start and end blocks are excluded (a camera inside a
    // wall isn't blinded; the target's own block doesn't hide it).
    lineSegmentIsBlockedByDrawnVoxelBlock(from: THREE.Vector3, to: THREE.Vector3): boolean
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return false;
        const voxels = room.voxelGrid.voxels;

        // A block of the walk is one collision layer of one voxel: a unit square in XZ, one layer tall.
        let col = VoxelQueryUtil.getVoxelColFromWorldX(from.x);
        let row = VoxelQueryUtil.getVoxelRowFromWorldZ(from.z);
        let collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(from.y);

        const endCol = VoxelQueryUtil.getVoxelColFromWorldX(to.x);
        const endRow = VoxelQueryUtil.getVoxelRowFromWorldZ(to.z);
        const endCollisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(to.y);

        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const absDx = Math.abs(dx), absDy = Math.abs(dy), absDz = Math.abs(dz);
        const colStep = Math.sign(dx), rowStep = Math.sign(dz), layerStep = Math.sign(dy);

        // Per-axis cost of one block (as a segment fraction) and distance to the next boundary.
        const colStride = (absDx > 0) ? (1 / absDx) : Infinity;
        const rowStride = (absDz > 0) ? (1 / absDz) : Infinity;
        const layerStride = (absDy > 0) ? (COLLISION_LAYER_HEIGHT / absDy) : Infinity;

        let colBoundary = (absDx > 0)
            ? (((colStep > 0) ? (col + 1 - from.x) : (from.x - col)) / absDx) : Infinity;
        let rowBoundary = (absDz > 0)
            ? (((rowStep > 0) ? (row + 1 - from.z) : (from.z - row)) / absDz) : Infinity;
        let layerBoundary = (absDy > 0)
            ? (((layerStep > 0)
                ? ((collisionLayer + 1) * COLLISION_LAYER_HEIGHT - from.y)
                : (from.y - collisionLayer * COLLISION_LAYER_HEIGHT)) / absDy)
            : Infinity;

        // The target stands where the viewpoint does, so there is no block in between to speak of.
        if (col === endCol && row === endRow && collisionLayer === endCollisionLayer)
            return false;

        for (let step = 0; step < maxGridWalkSteps; ++step)
        {
            // Cross into the next block over whichever boundary the segment reaches first.
            let boundaryCrossed: number;
            if (colBoundary <= rowBoundary && colBoundary <= layerBoundary)
            {
                boundaryCrossed = colBoundary;
                col += colStep;
                colBoundary += colStride;
            }
            else if (rowBoundary <= layerBoundary)
            {
                boundaryCrossed = rowBoundary;
                row += rowStep;
                rowBoundary += rowStride;
            }
            else
            {
                boundaryCrossed = layerBoundary;
                collisionLayer += layerStep;
                layerBoundary += layerStride;
            }

            if (boundaryCrossed >= 1)
                return false; // Stepped past the target itself, which the block test above may have missed.

            // Check arrival before judging the block, since wall attachments often sit exactly on a
            // boundary and may round into the wall block.
            if (col === endCol && row === endRow && collisionLayer === endCollisionLayer)
                return false;

            if (voxelBlockIsDrawn(voxels, row, col, collisionLayer))
                return true;
        }
        return false;
    },

    // How far the visible open space ahead drops below the viewer's standing level (>= 0). Measures
    // where there is room to look, which distinguishes a platform over a floor from an upper storey.
    // Space above standing level is ignored. Voxels with nothing to look down into (solid, level, or
    // occluded) count as zero rather than being skipped, so walls weigh against pits. Weighted by
    // horizontal proximity and facing.
    getOpenSpaceDropAhead(viewPosition: THREE.Vector3, forwardDir: THREE.Vector3,
        standingLevelY: number): number
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return 0;
        const voxels = room.voxelGrid.voxels;

        const forwardLength = Math.hypot(forwardDir.x, forwardDir.z);
        if (forwardLength < NEAR_EPSILON)
            return 0; // Facing straight up or down, leaving no direction on the plane to be ahead of.
        const forwardX = forwardDir.x / forwardLength;
        const forwardZ = forwardDir.z / forwardLength;

        const minCol = VoxelQueryUtil.getVoxelColFromWorldX(viewPosition.x - openSpaceReach);
        const maxCol = VoxelQueryUtil.getVoxelColFromWorldX(viewPosition.x + openSpaceReach);
        const minRow = VoxelQueryUtil.getVoxelRowFromWorldZ(viewPosition.z - openSpaceReach);
        const maxRow = VoxelQueryUtil.getVoxelRowFromWorldZ(viewPosition.z + openSpaceReach);

        let weightedDropSum = 0;
        let weightSum = 0;
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                // Also what keeps the square of voxels above from reaching outside the room.
                const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
                if (voxel == undefined)
                    continue;

                // Weight first: a zero-weight voxel can't affect the result.
                const weight = getVoxelProximityWeight(viewPosition, forwardX, forwardZ, row, col);
                if (weight <= 0)
                    continue;

                // Zero is a real answer (see above).
                const drop = getVisibleDropBelow(voxel, row, col, viewPosition, standingLevelY);

                weightedDropSum += weight * drop;
                weightSum += weight;
            }
        }
        return (weightSum > 0) ? (weightedDropSum / weightSum) : 0;
    },
}

// Weight in [0, 1]: distance falloff times horizontal facing, both fading smoothly to zero at limits.
function getVoxelProximityWeight(viewPosition: THREE.Vector3, forwardX: number, forwardZ: number,
    row: number, col: number): number
{
    const offsetX = col + 0.5 - viewPosition.x;
    const offsetZ = row + 0.5 - viewPosition.z;
    const dist = Math.hypot(offsetX, offsetZ);
    if (dist >= openSpaceReach)
        return 0;

    const nearness = 1 - dist / openSpaceReach;
    if (dist < NEAR_EPSILON)
        return nearness; // The voxel the viewer stands in, than which none is more in front of him.

    const forwardness = (offsetX * forwardX + offsetZ * forwardZ) / dist; // = dot product between: (1) view direction and, (2) the voxel's offset direction from the view.
    return (forwardness > 0) ? (nearness * forwardness) : 0;
}

// Depth of the lowest visible empty block below the standing level, or 0. Uses empty blocks (room to
// look into) rather than surface heights, so a doorway differs from the wall beside it.
function getVisibleDropBelow(voxel: Voxel, row: number, col: number, viewPosition: THREE.Vector3,
    standingLevelY: number): number
{
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        // Stop at standing level; also bounds the cost.
        const blockCenterY = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer);
        if (blockCenterY >= standingLevelY)
            break;

        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            continue;

        // Block centre is precise enough, given the neighbourhood average.
        blockCenterTemp.set(col + 0.5, blockCenterY, row + 0.5);
        if (ClientVoxelQueryUtil.lineSegmentIsBlockedByDrawnVoxelBlock(viewPosition, blockCenterTemp))
            continue;

        return standingLevelY - blockCenterY;
    }
    return 0;
}

// Whether a block has anything drawn: false for empty blocks and blocks hidden by the orbit camera.
// Floor and ceiling count as blocks beyond the layer range.
function voxelBlockIsDrawn(voxels: Voxel[], row: number, col: number, collisionLayer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (voxel == undefined)
        return false; // Outside the room, where the room has nothing left to put in the way.

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        // Under the room or over it, which the room's floor and ceiling close off.
        const belowFloor = (collisionLayer < COLLISION_LAYER_MIN);
        return !quadIsTakenOutOfSight(belowFloor
            ? VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)
            : VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col));
    }

    if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
        return false;

    return !blockIsTakenOutOfSight(row, col, collisionLayer);
}

// Blocks are hidden whole (see OrbitOcclusionHider), so any drawn face answers for all; fully buried
// blocks were never in the way.
function blockIsTakenOutOfSight(row: number, col: number, collisionLayer: number): boolean
{
    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
    {
        const instanceId = VoxelQuadInstanceUtil.getInstanceId(firstQuadIndex + i);
        if (instanceId >= 0)
            return InstancedMeshGraphics.instanceIsHidden(voxelInstancedMeshId, instanceId);
    }
    return false;
}

// Quads not on show hold no instance (see VoxelQuadInstanceUtil), so they aren't "taken out of sight".
function quadIsTakenOutOfSight(quadIndex: number): boolean
{
    const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
    return instanceId >= 0 && InstancedMeshGraphics.instanceIsHidden(voxelInstancedMeshId, instanceId);
}

export default ClientVoxelQueryUtil;
