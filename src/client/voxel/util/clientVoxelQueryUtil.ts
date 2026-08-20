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

//------------------------------------------------------------------------
// What the room's voxels amount to on screen, as opposed to what the grid holds — which is what
// VoxelQueryUtil answers, and which the client alone cannot settle: a block the orbit camera has
// taken out of the way is still in the grid, and still solid to walk into, while being no part of
// what the user is looking at (see OrbitOcclusionHider).
//
// Questions are asked of "the room" rather than of a grid handed in, there being exactly one room
// the client is drawing at a time, so that a caller with a world-space question of its own need
// know nothing about voxels to ask it.
//------------------------------------------------------------------------

// Every voxel quad in the room is drawn from this one instanced mesh, in which a quad's index in
// the grid is also its instance id.
const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

// One step of the walk below crosses one block boundary, and the grid is finite, so the walk is too.
// The bound is only there to keep a degenerate segment — one aimed far outside the room, or one
// whose ends float-round oddly — from turning a missed destination into a spin.
const maxGridWalkSteps = NUM_VOXEL_ROWS + NUM_VOXEL_COLS + NUM_COLLISION_LAYERS + 3;

// How far into the room the open space around a viewpoint is measured (see getOpenSpaceDropAhead).
// Far enough to take in the ground a walk of a few seconds would cover, and near enough that what
// the viewer is standing among still decides the answer rather than the far side of the room.
const openSpaceReach = 5; // in world units

const blockCenterTemp = new THREE.Vector3();

const ClientVoxelQueryUtil =
{
    getVoxelInstancedMeshId(): string
    {
        return voxelInstancedMeshId;
    },

    // Whether the room's own geometry stands between two points, as the room is currently drawn.
    //
    // The grid is walked block by block along the segment rather than raycast, because the room
    // draws every one of its quads from a single instanced mesh and three.js tests a ray against
    // every instance such a mesh holds — a whole room's worth, for a question asked every frame.
    // The walk instead costs one step per block boundary the segment crosses, whatever the room is
    // built of.
    //
    // The block the segment starts in is not counted, so a camera pushed into a wall does not blind
    // itself, and neither is the block it ends in, that being the one the target stands in. Which is
    // to say this is not the segment *intersecting* a block: a segment ending deep inside a wall is
    // blocked by nothing.
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

        // How much of the segment (as a fraction of its length) one whole block costs on each axis,
        // and how much of it is left before the next block boundary on that axis. An axis the segment
        // does not travel along never comes up, so its boundary is never reached.
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

        for (let step = 0; step < maxGridWalkSteps; ++step)
        {
            if (col === endCol && row === endRow && collisionLayer === endCollisionLayer)
                return false; // Arrived at the block the target stands in, having met nothing solid.

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

            if (voxelBlockIsDrawn(voxels, row, col, collisionLayer))
                return true;
        }
        return false;
    },

    // How far the room's open space ahead of a viewpoint drops below the level that viewpoint
    // stands at, in world units: zero while the ground ahead lies at his own level or above it,
    // and growing as it falls away beneath him.
    //
    // "Open space" is the empty part of the room the viewpoint can actually see into, block by
    // block, so what this answers is where there is somewhere to look rather than where the ground
    // happens to be — which is what tells apart a viewer standing on a platform over an open floor,
    // who finds the room falling away in front of him, from one standing on the upper storey of a
    // building, who finds it laid out around him at his own level however high above the room's
    // floor he has climbed.
    //
    // Measured against the level the viewer stands at rather than his eye, and never below zero,
    // because the space over his head is no part of the question. Every room has open space above a
    // viewer — that is what headroom is — and weighing it against the space below him would answer
    // for the height of the room rather than for the lie of its ground: an open column of a room
    // reads as its own midpoint, so a viewer would have to climb past the middle of the room before
    // what lies beneath him counted for anything, by which point he has usually arrived wherever he
    // was climbing to.
    //
    // A voxel with nothing to look down into — filled solid, standing level with the viewer, or
    // standing behind something that fills the way to it — answers zero rather than dropping out of
    // the reckoning. A wall is not an absence of an answer, but the answer that there is nothing to
    // look down into that way, and it has to weigh against the open ground beside it: a viewer
    // facing a wall across a pit would otherwise be shown the pit he cannot see instead of the wall
    // he is facing.
    //
    // Every voxel within reach contributes what its own space says, weighted by how near it is and
    // how squarely the viewer faces it. Both are measured on the horizontal plane, since what the
    // weighting stands for is which way the viewer is facing rather than how steeply he is looking.
    // Weighing a voxel by the full angle to it in space would push away precisely the space lying
    // low in front of him — the space this measure exists to find.
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

                // Settled before the voxel is looked into, since a voxel carrying no weight is one
                // whose contents cannot change the answer however much is on view in it.
                const weight = getVoxelProximityWeight(viewPosition, forwardX, forwardZ, row, col);
                if (weight <= 0)
                    continue;

                // A voxel with nothing below the viewer on view is not silent: it answers that this
                // way holds nothing to look down into, which is as much of the answer as an opening
                // is (see above).
                const drop = getVisibleDropBelow(voxel, row, col, viewPosition, standingLevelY);

                weightedDropSum += weight * drop;
                weightSum += weight;
            }
        }
        return (weightSum > 0) ? (weightedDropSum / weightSum) : 0;
    },
}

// How near one voxel is to a viewpoint, as a share between 0 and 1 — near in both of the senses that
// bear on what he is looking at: how short the way to it is, times how squarely he faces it. Both
// fade to nothing at their limits — at the edge of the reach, and at a right angle to the way the
// viewer faces — so that a voxel coming into the measure or leaving it does so without a step in
// the answer.
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

// How far one voxel's open space falls below a standing level: the depth of the lowest empty block
// of it the viewpoint can see from there, or zero where it can see none below that level — a voxel
// filled to the top, one whose own ground lies level with the viewer, or one standing behind
// something that fills the way to it.
//
// The lowest block on view rather than an average of those on view, so that a voxel answers with
// how far down there is to look into it. Taken off the empty blocks rather than off the height of
// whatever fills the voxel, so that it answers about where there is room to look instead of where a
// surface is: a doorway through a wall and the solid wall beside it carry their surfaces at the same
// height, and only one of the two is somewhere to look.
function getVisibleDropBelow(voxel: Voxel, row: number, col: number, viewPosition: THREE.Vector3,
    standingLevelY: number): number
{
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        // A block standing at the viewer's own level is nothing to look *down* into, and neither is
        // anything above it, so the walk up the column ends here. Which is also what keeps the cost
        // of this to the part of the room below him however tall the room is.
        const blockCenterY = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer);
        if (blockCenterY >= standingLevelY)
            break;

        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            continue;

        // Aimed at the block's middle, which is as fine as this needs to be: the answer is already
        // an average over a whole neighbourhood of blocks, so where within one of them the line
        // lands changes nothing about it.
        blockCenterTemp.set(col + 0.5, blockCenterY, row + 0.5);
        if (ClientVoxelQueryUtil.lineSegmentIsBlockedByDrawnVoxelBlock(viewPosition, blockCenterTemp))
            continue;

        return standingLevelY - blockCenterY;
    }
    return 0;
}

// Whether one block of the grid has anything of the room drawn in it. An empty block has nothing to
// draw, and neither, for the moment, has one the orbit camera has taken out of sight — the opening
// it leaves being one the room really is seen through. The room's floor and ceiling count as blocks
// of their own here, lying past the ends of the collision layers.
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

// Whether the orbit camera is currently holding one block of the room out of the way. A block goes
// out of sight whole, every face of it at once (see OrbitOcclusionHider), so whichever of its faces
// is being drawn answers for all six — and a block none of whose faces is drawn, being buried in
// the middle of something, was never in anyone's way to begin with.
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

// The same question for a single quad. A quad that is not on show holds no instance at all (see
// VoxelQuadInstanceUtil), and is not something the camera has taken away — it is something the room
// never had on view in the first place, which is what a floor tile covered by a block amounts to.
function quadIsTakenOutOfSight(quadIndex: number): boolean
{
    const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
    return instanceId >= 0 && InstancedMeshGraphics.instanceIsHidden(voxelInstancedMeshId, instanceId);
}

export default ClientVoxelQueryUtil;
