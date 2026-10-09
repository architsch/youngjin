import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS } from "../../../../shared/system/sharedConstants";
import { LIGHT_REGION_SIZE_XZ } from "../../../system/clientConstants";
import { getLightLuminance } from "./lightBlockPropagationUtil";
import LightRegionUtil from "./lightRegionUtil";

// For every open region (see LightRegionUtil), the brightest light nearby, discounted by distance. Read by
// the head light (see GraphicsManager) so it stays dimmed while a lamp's pool is viewed from outside its
// reach.
//
// Max (not sum) so a lamp's weight doesn't depend on how many regions it lights. The discount is
// Gaussian over straight-line distance, which makes it separable into per-axis sweeps that still
// produce a ball. Sweeps stop at closed regions, so light rounds corners but never passes walls; where
// it falls short, it errs toward giving the head light back.

// Gaussian standard deviation in world units. Exported for tests.
export const NEARBY_LIGHT_SPREAD = 3.5;

const NUM_REGIONS = LightRegionUtil.numRegions;

// Reused across runs (this runs on every lamp drag). Stored as log luminance (the Gaussian becomes a
// subtracted parabola) plus the source region, since a uniform discount preserves the source's color.
const logLuminanceByRegion = new Float64Array(NUM_REGIONS);
const sourceByRegion = new Int32Array(NUM_REGIONS);

// Upper-envelope parabolas for one run (see sweepRun). Stored separately so a run can be overwritten
// in place.
const LONGEST_AXIS_LENGTH = Math.max(NUM_COLLISION_LAYERS, LightRegionUtil.numCols, LightRegionUtil.numRows);
const envelopePositions = new Int32Array(LONGEST_AXIS_LENGTH);
const envelopeLogLuminance = new Float64Array(LONGEST_AXIS_LENGTH);
const envelopeSources = new Int32Array(LONGEST_AXIS_LENGTH);
const envelopeStarts = new Float64Array(LONGEST_AXIS_LENGTH);

const LightBlockDilationUtil =
{
    // Writes discounted nearby light (linear RGB, 3 entries per region) into outField; 0 for closed regions.
    dilate(field: Float32Array, outField: Float32Array, isOpen: Uint8Array)
    {
        for (let regionIndex = 0; regionIndex < NUM_REGIONS; ++regionIndex)
        {
            const at = regionIndex * 3;
            const luminance = getLightLuminance(field[at], field[at + 1], field[at + 2]);
            logLuminanceByRegion[regionIndex] = (isOpen[regionIndex] !== 0 && luminance > 0)
                ? Math.log(luminance)
                : Number.NEGATIVE_INFINITY;
            sourceByRegion[regionIndex] = regionIndex;
        }

        // Strides follow the region index layout (layer, col, row); layer steps are shorter in world units.
        sweepAxis(isOpen, 1, NUM_COLLISION_LAYERS, COLLISION_LAYER_HEIGHT);
        sweepAxis(isOpen, NUM_COLLISION_LAYERS, LightRegionUtil.numCols, LIGHT_REGION_SIZE_XZ);
        sweepAxis(isOpen, LightRegionUtil.numCols * NUM_COLLISION_LAYERS, LightRegionUtil.numRows, LIGHT_REGION_SIZE_XZ);

        for (let regionIndex = 0; regionIndex < NUM_REGIONS; ++regionIndex)
        {
            const at = regionIndex * 3;
            const logLuminance = logLuminanceByRegion[regionIndex];
            if (logLuminance === Number.NEGATIVE_INFINITY)
            {
                outField[at] = 0;
                outField[at + 1] = 0;
                outField[at + 2] = 0;
                continue;
            }

            // The source region's color, scaled by the distance discount.
            const sourceAt = sourceByRegion[regionIndex] * 3;
            const discount = Math.exp(logLuminance) / getLightLuminance(
                field[sourceAt], field[sourceAt + 1], field[sourceAt + 2]);
            outField[at] = field[sourceAt] * discount;
            outField[at + 1] = field[sourceAt + 1] * discount;
            outField[at + 2] = field[sourceAt + 2] * discount;
        }
    },
}

function sweepAxis(isOpen: Uint8Array, stride: number, axisLength: number, regionSize: number)
{
    // Log-space discount per squared region of distance along this axis.
    const curvature = (regionSize * regionSize) / (2 * NEARBY_LIGHT_SPREAD * NEARBY_LIGHT_SPREAD);

    const lineSpan = stride * axisLength;
    for (let spanStart = 0; spanStart < NUM_REGIONS; spanStart += lineSpan)
    {
        for (let lineStart = spanStart; lineStart < spanStart + stride; ++lineStart)
        {
            // Closed regions break a line into independent runs of open ones.
            let position = 0;
            while (position < axisLength)
            {
                if (isOpen[lineStart + position * stride] === 0)
                {
                    ++position;
                    continue;
                }
                const runStart = position;
                while (position < axisLength && isOpen[lineStart + position * stride] !== 0)
                    ++position;
                sweepRun(lineStart, stride, runStart, position, curvature);
            }
        }
    }
}

// Max of equal-curvature parabolas over a run, in one pass via their upper envelope (any two cross
// exactly once, so a parabola overtaken on both sides is dropped).
function sweepRun(lineStart: number, stride: number, runStart: number, runEnd: number,
    curvature: number)
{
    let top = -1;
    for (let position = runStart; position < runEnd; ++position)
    {
        const regionIndex = lineStart + position * stride;
        const logLuminance = logLuminanceByRegion[regionIndex];
        if (logLuminance === Number.NEGATIVE_INFINITY)
            continue;

        let overtakesAt = Number.NEGATIVE_INFINITY;
        while (top >= 0)
        {
            const previous = envelopePositions[top];
            overtakesAt = 0.5 * (previous + position +
                (envelopeLogLuminance[top] - logLuminance) / (curvature * (position - previous)));
            if (top > 0 && overtakesAt <= envelopeStarts[top])
                --top;
            else
                break;
        }
        ++top;
        envelopePositions[top] = position;
        envelopeLogLuminance[top] = logLuminance;
        envelopeSources[top] = sourceByRegion[regionIndex];
        envelopeStarts[top] = (top === 0) ? Number.NEGATIVE_INFINITY : overtakesAt;
    }

    if (top < 0)
        return;

    let segment = 0;
    for (let position = runStart; position < runEnd; ++position)
    {
        while (segment < top && envelopeStarts[segment + 1] <= position)
            ++segment;
        const offset = position - envelopePositions[segment];
        const regionIndex = lineStart + position * stride;
        logLuminanceByRegion[regionIndex] = envelopeLogLuminance[segment] -
            curvature * offset * offset;
        sourceByRegion[regionIndex] = envelopeSources[segment];
    }
}

export default LightBlockDilationUtil;
