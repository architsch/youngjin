import * as THREE from "three";
import App from "../../app";
import InstancedMeshGraphics from "../../object/components/instancedMeshGraphics";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import VoxelQuadInstanceUtil from "./voxelQuadInstanceUtil";
import Vec3 from "../../../shared/math/types/vec3";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NEAR_EPSILON,
    NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID } from "../../../shared/system/sharedConstants";

// Queries about the room as drawn (vs. VoxelQueryUtil's stored grid): blocks hidden by the orbit camera
// are still solid but not visible (see OrbitOcclusionHider). Always about the single current room.

// The voxel mesh (quad index = instance id).
const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

// Upper bound on walk steps: enough to cross the whole room and the margin either side of it (see
// ROOM_BOX_MARGIN), guarding against degenerate segments.
const maxGridWalkSteps = NUM_VOXEL_ROWS + NUM_VOXEL_COLS + NUM_COLLISION_LAYERS + 12;

// How far past the room the ray walk's box reaches (see getFirstDrawnFaceAlongRay): a whole block, since
// the walk never judges the block it ends in, and one just past the floor is the one the floor tile tops.
const ROOM_BOX_MARGIN = 1;

// Reach for the open-space measure (see getOpenSpaceDropAhead).
const openSpaceReach = 5; // in world units

const blockCenterTemp = new THREE.Vector3();
const roomBoxTemp = new THREE.Box3();
const segmentStartTemp = new THREE.Vector3();
const segmentEndTemp = new THREE.Vector3();

const ClientVoxelQueryUtil =
{
    getVoxelInstancedMeshId(): string
    {
        return voxelInstancedMeshId;
    },

    // Whether drawn room geometry lies between two points. Walks blocks along the segment (raycasting
    // the voxel mesh would test every instance). Start and end blocks are excluded (a camera inside a
    // wall isn't blinded; the target's own block doesn't hide it). A block stops the segment only if
    // the face it enters through is drawn, so the rock around the room — solid but with nothing drawn
    // on the outside — lets the segment through, just as it lets the eye through.
    lineSegmentIsBlockedByDrawnVoxelBlock(from: THREE.Vector3, to: THREE.Vector3): boolean
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return false;
        const voxels = room.voxelGrid.voxels;
        return walkBlocks(from, to, (row, col, collisionLayer, entryAxis, entryOrientation) =>
            voxelBlockFaceIsDrawn(voxels, row, col, collisionLayer, entryAxis, entryOrientation));
    },

    // The first drawn face the ray meets, as lineSegmentIsBlockedByDrawnVoxelBlock judges one: where it
    // is met, and the axis direction the face looks along. Objects are not considered.
    getFirstDrawnFaceAlongRay(ray: THREE.Ray): {point: Vec3, normal: Vec3} | undefined
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return undefined;
        const voxels = room.voxelGrid.voxels;

        // Only the stretch through the room can meet a face, and the walk is bounded by the room's size.
        // The box reaches past the room so that a walk from outside enters every block through a face, and
        // one leaving through the floor or ceiling crosses it before it ends.
        roomBoxTemp.min.set(-ROOM_BOX_MARGIN, -ROOM_BOX_MARGIN, -ROOM_BOX_MARGIN);
        roomBoxTemp.max.set(NUM_VOXEL_COLS + ROOM_BOX_MARGIN, MAX_ROOM_Y + ROOM_BOX_MARGIN,
            NUM_VOXEL_ROWS + ROOM_BOX_MARGIN);
        const span = getRaySpanInBox(ray, roomBoxTemp);
        if (span == undefined)
            return undefined;
        ray.at(span.enter, segmentStartTemp);
        ray.at(span.exit, segmentEndTemp);

        let hit: {point: Vec3, normal: Vec3} | undefined = undefined;
        walkBlocks(segmentStartTemp, segmentEndTemp, (row, col, collisionLayer, entryAxis, entryOrientation,
            along) =>
        {
            if (!voxelBlockFaceIsDrawn(voxels, row, col, collisionLayer, entryAxis, entryOrientation))
                return false;
            const point = segmentStartTemp.clone().lerp(segmentEndTemp, along);
            const normal: Vec3 = {x: 0, y: 0, z: 0};
            normal[entryAxis] = (entryOrientation == "+") ? 1 : -1;
            hit = {point: {x: point.x, y: point.y, z: point.z}, normal};
            return true;
        });
        return hit;
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

        // An eye buried in solid rock — an arrival still standing in the wall behind its door — has no
        // open space to measure, and its sight lines would leave through buried faces (see above).
        if (VoxelQueryUtil.isVoxelBlockOccupied(voxels,
            VoxelQueryUtil.getVoxelRowFromWorldZ(viewPosition.z),
            VoxelQueryUtil.getVoxelColFromWorldX(viewPosition.x),
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(viewPosition.y)))
        {
            return 0;
        }

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

// Walks the blocks a segment passes through after from's own, handing visit each one with the face it is
// entered through (the face looking back the way the segment came) and how far along the segment that is,
// from 0 to 1. Stops before to's block, or when visit returns true, which the walk then returns.
function walkBlocks(from: THREE.Vector3, to: THREE.Vector3,
    visit: (row: number, col: number, collisionLayer: number, entryAxis: "x" | "y" | "z",
        entryOrientation: "-" | "+", along: number) => boolean): boolean
{
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

    // The segment ends in the block it starts in, so there is no block in between to speak of.
    if (col === endCol && row === endRow && collisionLayer === endCollisionLayer)
        return false;

    for (let step = 0; step < maxGridWalkSteps; ++step)
    {
        // Cross into the next block over whichever boundary the segment reaches first.
        let boundaryCrossed: number;
        let entryAxis: "x" | "y" | "z";
        let entryStep: number;
        if (colBoundary <= rowBoundary && colBoundary <= layerBoundary)
        {
            boundaryCrossed = colBoundary;
            col += colStep;
            colBoundary += colStride;
            entryAxis = "x";
            entryStep = colStep;
        }
        else if (rowBoundary <= layerBoundary)
        {
            boundaryCrossed = rowBoundary;
            row += rowStep;
            rowBoundary += rowStride;
            entryAxis = "z";
            entryStep = rowStep;
        }
        else
        {
            boundaryCrossed = layerBoundary;
            collisionLayer += layerStep;
            layerBoundary += layerStride;
            entryAxis = "y";
            entryStep = layerStep;
        }

        if (boundaryCrossed >= 1)
            return false; // Stepped past the end itself, which the block test below may have missed.

        // Check arrival before judging the block, since attached objects often sit exactly on a
        // boundary and may round into the block behind them.
        if (col === endCol && row === endRow && collisionLayer === endCollisionLayer)
            return false;

        if (visit(row, col, collisionLayer, entryAxis, (entryStep > 0) ? "-" : "+", boundaryCrossed))
            return true;
    }
    return false;
}

// Where along the ray (in ray lengths) it enters and leaves the box, from its origin at the earliest.
// Undefined if it misses the box.
function getRaySpanInBox(ray: THREE.Ray, box: THREE.Box3): {enter: number, exit: number} | undefined
{
    let enter = 0;
    let exit = Infinity;
    for (const axis of ["x", "y", "z"] as const)
    {
        const origin = ray.origin[axis];
        const direction = ray.direction[axis];
        if (Math.abs(direction) < NEAR_EPSILON)
        {
            if (origin < box.min[axis] || origin > box.max[axis])
                return undefined;
            continue;
        }
        const t1 = (box.min[axis] - origin) / direction;
        const t2 = (box.max[axis] - origin) / direction;
        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
    }
    return (enter <= exit) ? {enter, exit} : undefined;
}

// Whether a block shows anything on the side a line enters it from: false for an empty block, for a
// face buried against its neighbour or turned away from the room, and for a block the orbit camera has
// hidden. Floor and ceiling count as the faces of the space beyond the layer range, which has no sides.
function voxelBlockFaceIsDrawn(voxels: Voxel[], row: number, col: number, collisionLayer: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (voxel == undefined)
        return false; // Outside the room, where the room has nothing left to put in the way.

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
    {
        // Under the room or over it, where the only thing standing is the room's own floor or ceiling.
        // Each is one flat tile lying at the boundary with the room, so a line meets it only on the
        // step that leaves the room through it, and only from the room's side, which is the side it is
        // drawn on. Deeper out, and from the side, there is nothing there at all.
        if (facingAxis != "y")
            return false;
        if (collisionLayer == COLLISION_LAYER_MIN - 1 && orientation == "+")
            return !quadIsTakenOutOfSight(VoxelQueryUtil.getFloorVoxelQuadIndex(row, col));
        if (collisionLayer == COLLISION_LAYER_MAX + 1 && orientation == "-")
            return !quadIsTakenOutOfSight(VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col));
        return false;
    }

    const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, facingAxis, orientation, collisionLayer);
    if ((voxel.quadsMem.quads[quadIndex] & 0b10000000) == 0)
        return false; // Nothing drawn on that side, so nothing there to stop the line.

    return !quadIsTakenOutOfSight(quadIndex);
}

// Quads not on show hold no instance (see VoxelQuadInstanceUtil), so they aren't "taken out of sight".
function quadIsTakenOutOfSight(quadIndex: number): boolean
{
    const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
    return instanceId >= 0 && InstancedMeshGraphics.instanceIsHidden(voxelInstancedMeshId, instanceId);
}

export default ClientVoxelQueryUtil;
