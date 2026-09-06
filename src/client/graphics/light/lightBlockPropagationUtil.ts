import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_BLOCKS } from "../../../shared/system/sharedConstants";
import { LIGHT_SOURCE_MIN_DISTANCE, VOXEL_BLOCK_NEIGHBOR_OFFSETS } from "../../system/clientConstants";
import LightSource from "./lightSource";

// Spreads light through a room's open voxel blocks. Deliberately knows nothing about three.js or
// about textures: what comes out is plain numbers in plain buffers, which is what lets the whole of
// this be tested without a GPU. LightBlockMap is the part that owns the textures and hands the
// results to the shaders.
//
// The search is a breadth-first flood fill that carries the *distance travelled* rather than the
// brightness remaining. What it settles is which blocks light can get to at all, and how much
// further than necessary it had to go to get to each of them; how bright a block ends up is worked
// out afterwards, from the straight line to the lamp, so that a lamp with nothing in its way falls
// off exactly as a real THREE.PointLight does. Stepping block to block only ever goes along the
// axes, so a brightness taken from the route itself would draw every lamp as a diamond.
//
// Two things keep it cheap. A light's own range bounds the search, so a small lamp costs a small ball
// of blocks rather than a sweep of the room; and because every step through the grid costs the same,
// breadth-first order reaches each block by its cheapest route first, so no block is ever visited
// twice.

// The buffers the fill works in, allocated once by the caller and reused by every light and every
// recomputation. Propagation runs whenever a lamp is dragged, so allocating buffers of this size per
// run would hand the garbage collector a steady stream of work in the middle of gameplay.
export class LightPropagationScratch
{
    // POSITIVE_INFINITY for a block this light has not reached.
    distanceFromLight = new Float32Array(NUM_VOXEL_BLOCKS);

    // A block is enqueued at most once per light, because every step costs the same and so the first
    // time a block is reached is also the cheapest. That invariant is what bounds this queue; it is
    // checked rather than assumed, since writing past the end of a typed array is silently dropped
    // rather than throwing.
    pendingBlockIndices = new Int32Array(NUM_VOXEL_BLOCKS);

    // The blocks this light reached, so that clearing up afterwards costs what the light cost rather
    // than the size of the room.
    reachedBlockIndices = new Int32Array(NUM_VOXEL_BLOCKS);

    constructor()
    {
        this.distanceFromLight.fill(Number.POSITIVE_INFINITY);
    }
}

const LightBlockPropagationUtil =
{
    // Spreads one light through the open blocks around it, adding what arrives at each of them into
    // the two accumulation buffers.
    //
    // outBlockLight holds three entries per block: linear RGB, summed over every light that reaches
    // it. outBlockFlux holds three entries per block: the direction light travelled in to get there,
    // weighted by how much of it arrived — so where two lamps meet, the brighter one wins the
    // direction. Neither is bounded above, which is why neither is the texture's own storage.
    accumulate(voxels: Voxel[], light: LightSource,
        outBlockLight: Float32Array, outBlockFlux: Float32Array,
        scratch: LightPropagationScratch): void
    {
        const startRow = VoxelQueryUtil.getVoxelRowFromWorldZ(light.worldPos.z);
        const startCol = VoxelQueryUtil.getVoxelColFromWorldX(light.worldPos.x);
        const startCollisionLayer =
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(light.worldPos.y);
        if (!VoxelQueryUtil.isVoxelBlockWithinBound(startRow, startCol, startCollisionLayer))
            return;
        // A lamp buried inside a solid block lights nothing. Worth passing over quietly rather than
        // treating as an error, since a lamp ends up inside a block whenever somebody builds over it.
        if (VoxelQueryUtil.isVoxelBlockOccupied(voxels, startRow, startCol, startCollisionLayer))
            return;

        const distanceFromLight = scratch.distanceFromLight;
        const pendingBlockIndices = scratch.pendingBlockIndices;
        const reachedBlockIndices = scratch.reachedBlockIndices;

        const startBlockIndex =
            VoxelQueryUtil.getVoxelBlockIndex(startRow, startCol, startCollisionLayer);
        distanceFromLight[startBlockIndex] = 0;

        let queueHead = 0;
        let queueTail = 0;
        pendingBlockIndices[queueTail++] = startBlockIndex;

        let numReached = 0;
        reachedBlockIndices[numReached++] = startBlockIndex;

        while (queueHead < queueTail)
        {
            const blockIndex = pendingBlockIndices[queueHead++];
            const distanceToBlock = distanceFromLight[blockIndex];
            const row = VoxelQueryUtil.getVoxelBlockRow(blockIndex);
            const col = VoxelQueryUtil.getVoxelBlockCol(blockIndex);
            const collisionLayer = VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex);

            for (let offsetIndex = 0; offsetIndex < VOXEL_BLOCK_NEIGHBOR_OFFSETS.length; ++offsetIndex)
            {
                const offset = VOXEL_BLOCK_NEIGHBOR_OFFSETS[offsetIndex];
                const neighborRow = row + offset.rowOffset;
                const neighborCol = col + offset.colOffset;
                const neighborCollisionLayer = collisionLayer + offset.collisionLayerOffset;
                if (!VoxelQueryUtil.isVoxelBlockWithinBound(
                    neighborRow, neighborCol, neighborCollisionLayer))
                    continue;
                // Light stops at a solid block rather than passing through it. This is what gives
                // walls their shadows without any of the cost of shadow mapping.
                if (VoxelQueryUtil.isVoxelBlockOccupied(
                    voxels, neighborRow, neighborCol, neighborCollisionLayer))
                    continue;

                const distanceToNeighbor = distanceToBlock + offset.worldDistance;
                if (distanceToNeighbor >= light.range)
                    continue;

                const neighborBlockIndex = VoxelQueryUtil.getVoxelBlockIndex(
                    neighborRow, neighborCol, neighborCollisionLayer);
                // Compared against the distance already recorded rather than against a "visited"
                // flag. The two are equivalent while every step costs the same, and only this form
                // stays correct if that ever stops being true — an unevenly sized neighbourhood, or
                // blocks that dim light instead of stopping it, both make a later arrival able to
                // beat an earlier one.
                if (distanceToNeighbor >= distanceFromLight[neighborBlockIndex])
                    continue;

                if (queueTail >= NUM_VOXEL_BLOCKS)
                {
                    console.error("Voxel-block queue overflowed while propagating light.");
                    break;
                }
                if (distanceFromLight[neighborBlockIndex] === Number.POSITIVE_INFINITY)
                    reachedBlockIndices[numReached++] = neighborBlockIndex;
                distanceFromLight[neighborBlockIndex] = distanceToNeighbor;
                pendingBlockIndices[queueTail++] = neighborBlockIndex;
            }
        }

        // Only the blocks this light actually reached are accumulated — and then put back the way
        // they were found, so that adding a lamp to the room costs time proportional to that lamp's
        // range rather than to the size of the room, however many lamps have already been laid down.
        const lampX = worldXOfBlock(startBlockIndex);
        const lampY = worldYOfBlock(startBlockIndex);
        const lampZ = worldZOfBlock(startBlockIndex);

        for (let i = 0; i < numReached; ++i)
        {
            const blockIndex = reachedBlockIndices[i];

            const offsetX = worldXOfBlock(blockIndex) - lampX;
            const offsetY = worldYOfBlock(blockIndex) - lampY;
            const offsetZ = worldZOfBlock(blockIndex) - lampZ;
            // Held off zero, since the block a light stands in is at no distance from it at all
            // and a point light's falloff has no finite value there (see LIGHT_SOURCE_MIN_DISTANCE).
            const straightLineDistance = Math.max(LIGHT_SOURCE_MIN_DISTANCE,
                Math.sqrt(offsetX*offsetX + offsetY*offsetY + offsetZ*offsetZ));

            // How much further light had to travel than it would have with nothing in its way. The
            // comparison is against the shortest *grid* route rather than the straight line, because
            // stepping from block to block only ever goes along the axes: even in an empty room the
            // grid route is longer than the straight line, and charging a lamp for that would draw
            // it as a diamond rather than as a ball.
            const shortestOpenRoute = Math.abs(offsetX) + Math.abs(offsetY) + Math.abs(offsetZ);
            const routeTaken = distanceFromLight[blockIndex];
            const detour = (routeTaken > 0) ? Math.min(1, shortestOpenRoute / routeTaken) : 1;

            // Distance is measured in a straight line, so a lamp in the open falls off exactly as a
            // real THREE.PointLight does; the detour is what dims what it only reaches round a
            // corner, and standing in for the bounce that is not being simulated.
            const brightness = getDistanceAttenuation(
                straightLineDistance, light.range, light.decay) * detour * detour;

            const lightIndex = blockIndex * 3;
            outBlockLight[lightIndex    ] += light.colorR * brightness;
            outBlockLight[lightIndex + 1] += light.colorG * brightness;
            outBlockLight[lightIndex + 2] += light.colorB * brightness;

            // Which way the light lies, so a surface can be lit by how squarely it faces it. Taken
            // in a straight line for the same reason the distance is: a direction worked out from
            // the grid route quantizes to the axes, and a wall shaded by that comes out in bands.
            // A block reached only round a corner is therefore lit as though through the wall — but
            // the detour above has already made it dim, so what is misdirected is barely there.
            //
            // The block the lamp stands in is the exception with no direction at all, and is lit by
            // the direction-independent share alone rather than by a direction picked arbitrarily.
            if (straightLineDistance > 0)
            {
                // Weighted by how much arrived, so that where two lamps meet the brighter one wins
                // the direction rather than the two averaging into a direction neither lies in.
                const weight = brightness / straightLineDistance;
                outBlockFlux[lightIndex    ] += offsetX * weight;
                outBlockFlux[lightIndex + 1] += offsetY * weight;
                outBlockFlux[lightIndex + 2] += offsetZ * weight;
            }

            distanceFromLight[blockIndex] = Number.POSITIVE_INFINITY;
        }
    },
}

// A voxel block's centre in the world, by axis. Written out rather than built into a vector, since
// the accumulation loop runs over every block a lamp reaches and has no use for an object per block.
function worldXOfBlock(blockIndex: number): number
{
    return VoxelQueryUtil.getVoxelBlockCol(blockIndex) + 0.5;
}
function worldYOfBlock(blockIndex: number): number
{
    return VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(
        VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex));
}
function worldZOfBlock(blockIndex: number): number
{
    return VoxelQueryUtil.getVoxelBlockRow(blockIndex) + 0.5;
}

// The same curve three.js applies to a point light (a windowed inverse-power falloff), so that a
// light in the block map and a real THREE.PointLight of the same range and decay read as the same
// thing. Exported for the tests, which assert the block map against it rather than against numbers
// copied out of it.
export function getDistanceAttenuation(distanceToLight: number, range: number,
    decay: number): number
{
    const falloff = 1 / Math.max(Math.pow(distanceToLight, decay), 0.01);
    const rangeRatio = distanceToLight / range;
    const rangeRatioPow4 = rangeRatio * rangeRatio * rangeRatio * rangeRatio;
    const rangeWindow = Math.max(0, Math.min(1, 1 - rangeRatioPow4));
    return falloff * rangeWindow * rangeWindow;
}

export default LightBlockPropagationUtil;
