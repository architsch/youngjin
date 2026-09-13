import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_VOXEL_BLOCKS } from "../../../../shared/system/sharedConstants";
import { LIGHT_SOURCE_MIN_DISTANCE, VOXEL_BLOCK_NEIGHBOR_OFFSETS } from "../../../system/clientConstants";
import LightSource from "../types/lightSource";

// Spreads light through open voxel blocks into plain buffers (no three.js, so it is testable without a
// GPU). A BFS flood fill tracks route distance to find reachable blocks and detours; brightness is
// computed afterwards from straight-line distance so lamps are balls, not diamonds. The fill is
// bounded by the light's range.

// Reused across lights and recomputations to avoid GC churn during lamp drags.
export class LightPropagationScratch
{
    // POSITIVE_INFINITY for a block this light has not reached.
    distanceFromLight = new Float32Array(NUM_VOXEL_BLOCKS);

    // Layer steps are shorter than row/col steps, so BFS order isn't cheapest-first and a block can
    // be re-enqueued. Rare, but overflow is checked since typed arrays drop out-of-range writes.
    pendingBlockIndices = new Int32Array(NUM_VOXEL_BLOCKS);

    // So cleanup costs the light's reach, not the room size.
    reachedBlockIndices = new Int32Array(NUM_VOXEL_BLOCKS);

    constructor()
    {
        this.distanceFromLight.fill(Number.POSITIVE_INFINITY);
    }
}

const LightBlockPropagationUtil =
{
    // Adds one light into outBlockLight (linear RGB) and outBlockFlux (direction weighted by arrived
    // luminance, so the brighter lamp wins where lamps meet). Weighting by luminance also keeps
    // |flux| <= luminance, which LightBlockMap relies on.
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
        // A lamp built over lights nothing; not an error.
        if (VoxelQueryUtil.isVoxelBlockOccupied(voxels, startRow, startCol, startCollisionLayer))
            return;

        const distanceFromLight = scratch.distanceFromLight;
        const pendingBlockIndices = scratch.pendingBlockIndices;
        const reachedBlockIndices = scratch.reachedBlockIndices;

        const startBlockIndex =
            VoxelQueryUtil.getVoxelBlockIndex(startRow, startCol, startCollisionLayer);
        distanceFromLight[startBlockIndex] = 0;

        // Measured from the block centre so the fill bound and brightness agree.
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

                // Bounded by straight-line distance, not route length: axis-aligned routes would cut
                // diagonals short where the falloff is still strong, producing a hard diamond edge.
                const offsetToNeighborX = neighborCol + 0.5 - lampX;
                const offsetToNeighborY = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(
                    neighborCollisionLayer) - lampY;
                const offsetToNeighborZ = neighborRow + 0.5 - lampZ;
                if (offsetToNeighborX * offsetToNeighborX +
                    offsetToNeighborY * offsetToNeighborY +
                    offsetToNeighborZ * offsetToNeighborZ >= rangeSquared)
                    continue;

                // Solid blocks stop light (free wall shadows).
                if (VoxelQueryUtil.isVoxelBlockOccupied(
                    voxels, neighborRow, neighborCol, neighborCollisionLayer))
                    continue;

                const distanceToNeighbor = distanceToBlock + offset.worldDistance;

                const neighborBlockIndex = VoxelQueryUtil.getVoxelBlockIndex(
                    neighborRow, neighborCol, neighborCollisionLayer);
                // Distance comparison (not a visited flag) so a later, cheaper route can correct a block.
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

        // Accumulate only reached blocks and reset them, so cost scales with the lamp's reach.
        for (let i = 0; i < numReached; ++i)
        {
            const blockIndex = reachedBlockIndices[i];

            const offsetX = worldXOfBlock(blockIndex) - lampX;
            const offsetY = worldYOfBlock(blockIndex) - lampY;
            const offsetZ = worldZOfBlock(blockIndex) - lampZ;
            // Clamped: point-light falloff is infinite at zero distance.
            const straightLineDistance = Math.max(LIGHT_SOURCE_MIN_DISTANCE,
                Math.sqrt(offsetX*offsetX + offsetY*offsetY + offsetZ*offsetZ));

            // Detour relative to the shortest grid (Manhattan) route, since even an empty room's grid
            // route exceeds the straight line.
            const shortestOpenRoute = Math.abs(offsetX) + Math.abs(offsetY) + Math.abs(offsetZ);
            const routeTaken = distanceFromLight[blockIndex];
            const detour = (routeTaken > 0) ? Math.min(1, shortestOpenRoute / routeTaken) : 1;

            // Open-air falloff matches THREE.PointLight; the detour dims light that rounds corners.
            const brightness = getDistanceAttenuation(
                straightLineDistance, light.range, light.decay) * detour * detour;

            const lightIndex = blockIndex * 3;
            const arrivedR = light.colorR * brightness;
            const arrivedG = light.colorG * brightness;
            const arrivedB = light.colorB * brightness;
            outBlockLight[lightIndex    ] += arrivedR;
            outBlockLight[lightIndex + 1] += arrivedG;
            outBlockLight[lightIndex + 2] += arrivedB;

            // Straight-line direction (grid-route directions would band). The lamp's own block has
            // none, i.e. light from all sides, which lights the wall it is mounted on.
            if (straightLineDistance > 0)
            {
                const weight = getLightLuminance(arrivedR, arrivedG, arrivedB) / straightLineDistance;
                outBlockFlux[lightIndex    ] += offsetX * weight;
                outBlockFlux[lightIndex + 1] += offsetY * weight;
                outBlockFlux[lightIndex + 2] += offsetZ * weight;
            }

            distanceFromLight[blockIndex] = Number.POSITIVE_INFINITY;
        }
    },
}

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

// Perceptual luminance. The single measure used everywhere light is reduced to one number, so flux
// weighting and its later normalization agree.
export function getLightLuminance(colorR: number, colorG: number, colorB: number): number
{
    return 0.2126 * colorR + 0.7152 * colorG + 0.0722 * colorB;
}

// three.js's point-light falloff (windowed inverse power). Exported for tests.
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
