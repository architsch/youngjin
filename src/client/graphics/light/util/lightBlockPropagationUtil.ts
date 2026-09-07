import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_BLOCKS } from "../../../../shared/system/sharedConstants";
import { LIGHT_SOURCE_MIN_DISTANCE, VOXEL_BLOCK_NEIGHBOR_OFFSETS } from "../../../system/clientConstants";
import LightSource from "../types/lightSource";

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
// What keeps it cheap is that a light's own range bounds the search, so a small lamp costs a small
// ball of blocks rather than a sweep of the room. **The bound is the straight line back to the lamp
// rather than the length of the route taken**, which is what makes that ball a ball — see the range
// check itself for what bounding the route instead does to the shape of a lamp.

// The buffers the fill works in, allocated once by the caller and reused by every light and every
// recomputation. Propagation runs whenever a lamp is dragged, so allocating buffers of this size per
// run would hand the garbage collector a steady stream of work in the middle of gameplay.
export class LightPropagationScratch
{
    // POSITIVE_INFINITY for a block this light has not reached.
    distanceFromLight = new Float32Array(NUM_VOXEL_BLOCKS);

    // Very nearly one entry per block, but not exactly: a step along a row or column crosses a whole
    // block where a step between collision layers crosses the height of one, so breadth-first order
    // is not cheapest-first, and a block first reached by a long route can be reached again later by
    // a cheaper one and enqueued a second time. It is rare enough not to be worth the priority queue
    // that would rule it out — a room full of obstacles runs a couple of percent over one entry per
    // block — but it does mean the grid's own size is not a proof that this cannot overflow, so the
    // overflow is checked rather than assumed: writing past the end of a typed array is silently
    // dropped rather than throwing.
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
    //
    // **The weight is how much light arrived and not how far it travelled**, which is what keeps a
    // light from ever being able to take shading away from another. Weighed by the geometry alone,
    // a lamp carrying almost no light — one turned right down, or painted a color with little in
    // it — would swing the direction as hard as a lamp blazing beside it, and every surface around
    // the two would be shaded as though lit from a side nothing was lighting it from. The two
    // fields then also stay in step: the length of the direction a block records can never exceed
    // the light standing in it, which is what LightBlockMap goes on to read as how much of that
    // light has a direction at all.
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

        // Where the light stands, taken as the centre of the block it is in rather than as its own
        // position, so that the fill and the accumulation below agree on where it is. Both the range
        // the fill is bounded by and the distance the brightness is read off are measured from here.
        const lampX = worldXOfBlock(startBlockIndex);
        const lampY = worldYOfBlock(startBlockIndex);
        const lampZ = worldZOfBlock(startBlockIndex);
        const rangeSquared = light.range * light.range;

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

                // Where the light gives out, measured in a straight line back to it rather than
                // along the route travelled to get here — the same distance the brightness below is
                // read off, so that the fill stops exactly where the falloff reaches nothing.
                //
                // Bounding the route instead is what draws a lamp as a diamond, and it is a separate
                // road to the same place as the one the notes above close off. Stepping block to
                // block only ever goes along the axes, so a route is as long as the sides of the box
                // between its ends rather than as the line across it: the fill would carry the full
                // range along each axis but give out a factor of root two short on a flat diagonal
                // and root three short on a corner one. The falloff is nowhere near nothing at those
                // distances — better than half of what it reaches the end of an axis with — so the
                // light would not fade out there, it would stop dead, and the octahedron it stopped
                // on is what the eye reads as a lamp shaped like a diamond.
                //
                // Taken from the coordinates already in hand rather than back out of the neighbour's
                // block index: this is the innermost loop, and worldXOfBlock and its pair would only
                // divide out what these three variables are already holding.
                const offsetToNeighborX = neighborCol + 0.5 - lampX;
                const offsetToNeighborY = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(
                    neighborCollisionLayer) - lampY;
                const offsetToNeighborZ = neighborRow + 0.5 - lampZ;
                // Compared squared, since only the comparison is wanted and not the distance itself.
                if (offsetToNeighborX * offsetToNeighborX +
                    offsetToNeighborY * offsetToNeighborY +
                    offsetToNeighborZ * offsetToNeighborZ >= rangeSquared)
                    continue;

                // Light stops at a solid block rather than passing through it. This is what gives
                // walls their shadows without any of the cost of shadow mapping.
                if (VoxelQueryUtil.isVoxelBlockOccupied(
                    voxels, neighborRow, neighborCol, neighborCollisionLayer))
                    continue;

                const distanceToNeighbor = distanceToBlock + offset.worldDistance;

                const neighborBlockIndex = VoxelQueryUtil.getVoxelBlockIndex(
                    neighborRow, neighborCol, neighborCollisionLayer);
                // Compared against the distance already recorded rather than against a "visited"
                // flag, which is what lets a block be corrected when a cheaper route to it turns up
                // after a dearer one. That does happen here — a step between collision layers is
                // shorter than a step along a row or column, so breadth-first order is not
                // cheapest-first (see LightPropagationScratch) — and it would happen for other
                // reasons too if blocks ever dimmed light instead of stopping it.
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
            const arrivedR = light.colorR * brightness;
            const arrivedG = light.colorG * brightness;
            const arrivedB = light.colorB * brightness;
            outBlockLight[lightIndex    ] += arrivedR;
            outBlockLight[lightIndex + 1] += arrivedG;
            outBlockLight[lightIndex + 2] += arrivedB;

            // Which way the light lies, so a surface can be lit by how squarely it faces it. Taken
            // in a straight line for the same reason the distance is: a direction worked out from
            // the grid route quantizes to the axes, and a wall shaded by that comes out in bands.
            // A block reached only round a corner is therefore lit as though through the wall — but
            // the detour above has already made it dim, so what is misdirected is barely there.
            //
            // The block the lamp stands in is the exception with no direction at all, and is read
            // as light arriving from every side rather than from a direction picked arbitrarily —
            // which is what standing inside a lamp is. It is why the wall a lamp is mounted on is
            // lit by it rather than left in the dark behind it.
            if (straightLineDistance > 0)
            {
                // Weighted by how much arrived, so that where two lamps meet the brighter one wins
                // the direction rather than the two averaging into a direction neither lies in.
                // One number stands for "how much", and it is the luminance of what arrived: a
                // light is as directional as it is bright, and a light with nothing in it points
                // nowhere.
                const weight = getLightLuminance(arrivedR, arrivedG, arrivedB) / straightLineDistance;
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

// How much light a linear-space color stands for, as one number. The eye's own weighting rather
// than a plain average, so that "how much light is here" agrees with how much of it is actually
// seen — a full green fills a room and a full blue barely lifts it off black.
//
// Everything that has to reduce a light to a single quantity uses this one, so that the amount the
// direction is weighted by (above) and the amount LightBlockMap divides it back out by are the same
// measure. Two measures that disagreed would put the two fields out of step by a factor nobody
// could see the origin of.
export function getLightLuminance(colorR: number, colorG: number, colorB: number): number
{
    return 0.2126 * colorR + 0.7152 * colorG + 0.0722 * colorB;
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
