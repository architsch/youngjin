import Vec3 from "../../../../shared/math/types/vec3";
import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, VOXEL_CELL_SIZE }
    from "../../../../shared/system/sharedConstants";
import { LIGHT_SOURCE_MIN_DISTANCE } from "../../../system/clientConstants";
import LightSource from "../types/lightSource";

// Spreads light through open blocks into plain buffers (no three.js, so it is testable without a GPU). A
// flood fill finds what a light reaches and how far round its light goes to get there; brightness comes from
// straight-line distance, so lamps are balls, not diamonds. The fill is bounded by the light's range.

// Block index strides: layer fastest, then column, then row (see VoxelQueryUtil.getVoxelBlockIndex).
const COL_STRIDE = NUM_COLLISION_LAYERS;
const ROW_STRIDE = NUM_VOXEL_COLS * NUM_COLLISION_LAYERS;

// Distances are counted in half blocks, a block being a cube (see VOXEL_CELL_SIZE). Every block's centre
// lies on that grid, and so does a lamp (see ObjectAttachmentUtil), so a squared distance is a whole number
// and brightness a table lookup.
const HALF_BLOCK = 0.5 * VOXEL_CELL_SIZE;
const MAX_SQUARED_DISTANCE = 4 * (NUM_VOXEL_COLS * NUM_VOXEL_COLS +
    NUM_VOXEL_ROWS * NUM_VOXEL_ROWS + NUM_COLLISION_LAYERS * NUM_COLLISION_LAYERS);

// A point touches one block along each axis, or two where it lies between them.
const MAX_SEEDS = 8;

const UNREACHED = -1;

// Reused across lights and recomputations to avoid GC churn during lamp drags.
export class LightPropagationScratch
{
    // Steps along the open route from the light; UNREACHED for a block this light has not reached.
    stepsFromLight = new Int32Array(NUM_VOXEL_BLOCKS).fill(UNREACHED);

    // The fill's queue. Every step is as long as any other, so a block enters it once, and what it
    // holds when the fill ends is everything the light reached.
    pendingBlockIndices = new Int32Array(NUM_VOXEL_BLOCKS);

    // The blocks the fill starts from (see startFill).
    seedCols = new Int32Array(MAX_SEEDS);
    seedLayers = new Int32Array(MAX_SEEDS);
    seedRows = new Int32Array(MAX_SEEDS);

    // Brightness and direction weight by squared distance, as far as the range named goes. Lamps often
    // share their range and decay, so the tables are kept from one light to the next.
    brightnessBySquaredDistance = new Float32Array(MAX_SQUARED_DISTANCE + 1);
    directionBySquaredDistance = new Float32Array(MAX_SQUARED_DISTANCE + 1);
    numTableEntries = 0;
    tableRange = Number.NaN;
    tableDecay = Number.NaN;
}

const LightBlockPropagationUtil =
{
    // Which blocks light can be in: the cell layers holding none. Worked out once per recomputation, since
    // every pass asks it of every block.
    markOpen(voxels: Voxel[] | undefined, outIsOpen: Uint8Array)
    {
        if (voxels == undefined)
        {
            outIsOpen.fill(0);
            return;
        }
        // A voxel's blocks are contiguous, and voxels come in the order of their blocks.
        for (let voxelIndex = 0; voxelIndex < voxels.length; ++voxelIndex)
        {
            const blockLayerMask = voxels[voxelIndex].blockLayerMask;
            const firstBlockIndex = voxelIndex * NUM_COLLISION_LAYERS;
            for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                outIsOpen[firstBlockIndex + layer] = ((blockLayerMask >> layer) & 1) ^ 1;
        }
    },

    // Adds one light into outLight (linear RGB) and outFlux (direction weighted by arrived luminance, so
    // the brighter lamp wins where lamps meet), 3 entries per block. Weighting by luminance also keeps
    // |flux| <= luminance, which LightBlockMap relies on. isOpen: see markOpen.
    accumulate(isOpen: Uint8Array, light: LightSource,
        outLight: Float32Array, outFlux: Float32Array,
        scratch: LightPropagationScratch): void
    {
        const numSeeds = startFill(isOpen, light.outletPos, scratch);
        // A lamp built over lights nothing; not an error.
        if (numSeeds === 0)
            return;

        const lightX = toHalfBlocks(light.worldPos.x);
        const lightY = toHalfBlocks(light.worldPos.y);
        const lightZ = toHalfBlocks(light.worldPos.z);

        prepareTables(light.range, light.decay, scratch);
        const numTableEntries = scratch.numTableEntries;
        const brightnessBySquaredDistance = scratch.brightnessBySquaredDistance;
        const directionBySquaredDistance = scratch.directionBySquaredDistance;
        const stepsFromLight = scratch.stepsFromLight;
        const pendingBlockIndices = scratch.pendingBlockIndices;

        const rangeInHalfBlocks = light.range / HALF_BLOCK;
        const rangeSquared = rangeInHalfBlocks * rangeInHalfBlocks;
        const luminance = getLightLuminance(light.colorR, light.colorG, light.colorB);

        let queueHead = 0;
        let queueTail = numSeeds;
        while (queueHead < queueTail)
        {
            const blockIndex = pendingBlockIndices[queueHead++];
            const steps = stepsFromLight[blockIndex];
            const layer = blockIndex % NUM_COLLISION_LAYERS;
            const columnIndex = (blockIndex - layer) / NUM_COLLISION_LAYERS;
            const col = columnIndex % NUM_VOXEL_COLS;
            const row = (columnIndex - col) / NUM_VOXEL_COLS;

            // From the light to this block's centre.
            const offsetX = 2 * col + 1 - lightX;
            const offsetY = 2 * layer + 1 - lightY;
            const offsetZ = 2 * row + 1 - lightZ;
            const squaredDistance = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;

            // Past the tables is past the range, where only what the fill started from can lie.
            if (squaredDistance < numTableEntries)
            {
                // Open-air falloff matches THREE.PointLight; the detour dims light that rounds corners. It
                // is relative to the shortest grid (Manhattan) route, since even an empty room's grid
                // route exceeds the straight line.
                let brightness = brightnessBySquaredDistance[squaredDistance];
                const shortestOpenRoute = getShortestOpenRoute(col, layer, row, numSeeds, scratch);
                if (shortestOpenRoute < steps)
                {
                    const detour = shortestOpenRoute / steps;
                    brightness *= detour * detour;
                }

                const lightIndex = blockIndex * 3;
                outLight[lightIndex    ] += light.colorR * brightness;
                outLight[lightIndex + 1] += light.colorG * brightness;
                outLight[lightIndex + 2] += light.colorB * brightness;

                // Straight-line direction (grid-route directions would band). It fades out inside the
                // light's own size, where light comes from all sides, which lights the wall a lamp is
                // mounted on.
                const weight = luminance * brightness * directionBySquaredDistance[squaredDistance];
                outFlux[lightIndex    ] += offsetX * weight;
                outFlux[lightIndex + 1] += offsetY * weight;
                outFlux[lightIndex + 2] += offsetZ * weight;
            }

            // Bounded by straight-line distance, not route length: axis-aligned routes would cut diagonals
            // short where the falloff is still strong, producing a hard diamond edge. A neighbour's squared
            // distance follows from this one's, its offset along one axis being 2 more or less.
            const nextSteps = steps + 1;
            if (col > 0 && squaredDistance + 4 - 4 * offsetX < rangeSquared)
                queueTail = reach(blockIndex - COL_STRIDE, nextSteps, isOpen, scratch, queueTail);
            if (col < NUM_VOXEL_COLS - 1 && squaredDistance + 4 + 4 * offsetX < rangeSquared)
                queueTail = reach(blockIndex + COL_STRIDE, nextSteps, isOpen, scratch, queueTail);
            if (row > 0 && squaredDistance + 4 - 4 * offsetZ < rangeSquared)
                queueTail = reach(blockIndex - ROW_STRIDE, nextSteps, isOpen, scratch, queueTail);
            if (row < NUM_VOXEL_ROWS - 1 && squaredDistance + 4 + 4 * offsetZ < rangeSquared)
                queueTail = reach(blockIndex + ROW_STRIDE, nextSteps, isOpen, scratch, queueTail);
            if (layer > 0 && squaredDistance + 4 - 4 * offsetY < rangeSquared)
                queueTail = reach(blockIndex - 1, nextSteps, isOpen, scratch, queueTail);
            if (layer < NUM_COLLISION_LAYERS - 1 && squaredDistance + 4 + 4 * offsetY < rangeSquared)
                queueTail = reach(blockIndex + 1, nextSteps, isOpen, scratch, queueTail);
        }

        // Reset only what was reached, so cleanup costs the light's reach, not the room size.
        for (let i = 0; i < queueTail; ++i)
            stepsFromLight[pendingBlockIndices[i]] = UNREACHED;
    },
}

// Onto the grid a lamp stands on (see HALF_BLOCK), which also takes out the error a stored position
// decodes with.
function toHalfBlocks(worldCoordinate: number): number
{
    return Math.round(worldCoordinate / HALF_BLOCK);
}

// Puts the open blocks a light's outlet touches into the fill, and returns how many: the one it is
// the centre of, or those it lies between (the middle of a lamp two blocks wide lies between two). So a
// lamp partly built over still lights from what is left open in front of it.
function startFill(isOpen: Uint8Array, outletPos: Vec3, scratch: LightPropagationScratch): number
{
    const outletX = toHalfBlocks(outletPos.x);
    const outletY = toHalfBlocks(outletPos.y);
    const outletZ = toHalfBlocks(outletPos.z);

    // A centre is an odd count of half blocks along its axis; an even one lies between two blocks.
    // Clamped to the room, which leaves a light outside it nothing to start from.
    const lastRow = Math.min(NUM_VOXEL_ROWS - 1, Math.floor(0.5 * outletZ));
    const lastCol = Math.min(NUM_VOXEL_COLS - 1, Math.floor(0.5 * outletX));
    const lastLayer = Math.min(NUM_COLLISION_LAYERS - 1, Math.floor(0.5 * outletY));

    let numSeeds = 0;
    for (let row = Math.max(0, Math.floor(0.5 * (outletZ - 1))); row <= lastRow; ++row)
    {
        for (let col = Math.max(0, Math.floor(0.5 * (outletX - 1))); col <= lastCol; ++col)
        {
            for (let layer = Math.max(0, Math.floor(0.5 * (outletY - 1))); layer <= lastLayer; ++layer)
            {
                const blockIndex = VoxelQueryUtil.getVoxelBlockIndex(row, col, layer);
                if (isOpen[blockIndex] === 0)
                    continue;

                scratch.seedCols[numSeeds] = col;
                scratch.seedLayers[numSeeds] = layer;
                scratch.seedRows[numSeeds] = row;
                scratch.stepsFromLight[blockIndex] = 0;
                scratch.pendingBlockIndices[numSeeds] = blockIndex;
                ++numSeeds;
            }
        }
    }
    return numSeeds;
}

// Takes a block into the fill if light can be in it and has not got there yet. Returns the queue's end.
function reach(blockIndex: number, steps: number, isOpen: Uint8Array,
    scratch: LightPropagationScratch, queueTail: number): number
{
    if (isOpen[blockIndex] === 0 || scratch.stepsFromLight[blockIndex] !== UNREACHED)
        return queueTail;
    scratch.stepsFromLight[blockIndex] = steps;
    scratch.pendingBlockIndices[queueTail] = blockIndex;
    return queueTail + 1;
}

// Steps to a block from the nearest of those the fill started from, with nothing in the way.
function getShortestOpenRoute(col: number, layer: number, row: number, numSeeds: number,
    scratch: LightPropagationScratch): number
{
    let shortest = Number.POSITIVE_INFINITY;
    for (let seed = 0; seed < numSeeds; ++seed)
    {
        const route = Math.abs(col - scratch.seedCols[seed]) +
            Math.abs(layer - scratch.seedLayers[seed]) + Math.abs(row - scratch.seedRows[seed]);
        if (route < shortest)
            shortest = route;
    }
    return shortest;
}

// Fills the tables for one range and decay, unless they hold them already.
function prepareTables(range: number, decay: number, scratch: LightPropagationScratch): void
{
    if (scratch.tableRange === range && scratch.tableDecay === decay)
        return;
    scratch.tableRange = range;
    scratch.tableDecay = decay;

    // As far as the range, which is as far as the fill spreads.
    const rangeInHalfBlocks = range / HALF_BLOCK;
    scratch.numTableEntries = 1 + Math.min(MAX_SQUARED_DISTANCE,
        Math.ceil(rangeInHalfBlocks * rangeInHalfBlocks));
    for (let squaredDistance = 0; squaredDistance < scratch.numTableEntries; ++squaredDistance)
    {
        // Clamped: point-light falloff is infinite at zero distance.
        const distance = Math.max(LIGHT_SOURCE_MIN_DISTANCE, HALF_BLOCK * Math.sqrt(squaredDistance));
        scratch.brightnessBySquaredDistance[squaredDistance] = getDistanceAttenuation(distance, range, decay);
        scratch.directionBySquaredDistance[squaredDistance] = HALF_BLOCK / distance;
    }
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
