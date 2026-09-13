import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import { getLightLuminance } from "./lightBlockPropagationUtil";

// Works out, for every open block, the brightest light standing anywhere near it, discounted by
// how far off that light is. Nothing is drawn from the result: it is what the lamp the camera
// carries reads to decide how far to stand down for the room's own lamps (see GraphicsManager).
//
// Why the light standing at the camera is not enough to decide that: a lamp's light gives out
// within its own reach, but the pool it leaves on a wall is seen from well outside that reach.
// Read only where the player stands, the head lamp comes back at full strength while the pool is
// still in view and flattens it under white light — and does so most harshly a few paces past the
// lamp's reach, which is just where somebody stands to look at one. Read here instead, a lamp goes
// on holding the head lamp down some way past its own light, and lets it back gradually rather
// than all at once at the edge of that light.
//
// **The brightest light nearby rather than a sum or an average**, so that what a lamp is reckoned
// to be worth does not depend on how many blocks of the room it happens to light. A brighter lamp
// is noticed from further off, since more of it is left once the discount has been taken.
//
// **The discount is a bell curve over straight-line distance**, which is what lets this be a
// separable pass — one sweep along each axis — and still reach a ball rather than a diamond: a
// bell curve's discount over a straight line is exactly the product of its discounts along the
// three axes. Each sweep stops at solid blocks, so light is only ever carried to a block along a
// route through open room that runs along each axis in turn. That finds its way round a corner but
// not through a maze, and where it falls short it errs toward handing the player's own lamp back,
// never toward taking it away in a place the room's light cannot reach — a lamp on the far side of
// a wall, or on the storey above, is not near anybody on this side of it.

// How quickly light stops counting as nearby, in world units: the bell curve's standard deviation.
// Light this far off counts for three fifths of itself, twice as far off for an eighth, and three
// times as far off for nothing worth the name. Exported for the tests, which assert the pass
// against a search of the whole room built on it rather than against numbers copied out of it.
export const NEARBY_LIGHT_SPREAD = 3.5;

// The working state the sweeps pass along, allocated once and reused by every run. This runs
// whenever a lamp is dragged, so allocating buffers of this size per run would hand the garbage
// collector a steady stream of work in the middle of gameplay (see LightPropagationScratch).
//
// Held as the logarithm of how much light there is, since that is where a bell curve's discount
// becomes a parabola to subtract — and as the block that light came from rather than as its
// color, since a discount dims every channel of a light by the same factor and so leaves its color
// exactly as the block it came from had it.
const logLuminanceByBlock = new Float64Array(NUM_VOXEL_BLOCKS);
const sourceByBlock = new Int32Array(NUM_VOXEL_BLOCKS);

// The parabolas making up one run's upper envelope (see sweepRun): where along the run each is
// cast from, the light and the source block it carries, and where along the run it takes over.
// Holding what each one carries here, rather than reading it back off the run, is what lets a run
// be overwritten in place.
const LONGEST_AXIS_LENGTH = Math.max(NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS);
const envelopePositions = new Int32Array(LONGEST_AXIS_LENGTH);
const envelopeLogLuminance = new Float64Array(LONGEST_AXIS_LENGTH);
const envelopeSources = new Int32Array(LONGEST_AXIS_LENGTH);
const envelopeStarts = new Float64Array(LONGEST_AXIS_LENGTH);

const LightBlockDilationUtil =
{
    // Writes into outField, three entries per block, the brightest light near each block of field,
    // discounted by how far off it is, in the same linear space and in the light's own color. A
    // solid block is written as holding none.
    dilate(field: Float32Array, outField: Float32Array, isOpen: Uint8Array)
    {
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
        {
            const at = blockIndex * 3;
            const luminance = getLightLuminance(field[at], field[at + 1], field[at + 2]);
            logLuminanceByBlock[blockIndex] = (isOpen[blockIndex] !== 0 && luminance > 0)
                ? Math.log(luminance)
                : Number.NEGATIVE_INFINITY;
            sourceByBlock[blockIndex] = blockIndex;
        }

        // The stride between neighbouring blocks along each axis follows the block index's layout:
        // the collision layer varies fastest, then the column, then the row. A step between layers
        // is shorter in the world than a step along the floor, and is discounted as such.
        sweepAxis(isOpen, 1, NUM_COLLISION_LAYERS, COLLISION_LAYER_HEIGHT);
        sweepAxis(isOpen, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, 1);
        sweepAxis(isOpen, NUM_VOXEL_COLS * NUM_COLLISION_LAYERS, NUM_VOXEL_ROWS, 1);

        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
        {
            const at = blockIndex * 3;
            const logLuminance = logLuminanceByBlock[blockIndex];
            if (logLuminance === Number.NEGATIVE_INFINITY)
            {
                outField[at] = 0;
                outField[at + 1] = 0;
                outField[at + 2] = 0;
                continue;
            }

            // The light that arrived here is the source block's own, dimmed by whatever the
            // distance cost it — which is what is left of the logarithm once the source's own is
            // taken back out.
            const sourceAt = sourceByBlock[blockIndex] * 3;
            const discount = Math.exp(logLuminance) / getLightLuminance(
                field[sourceAt], field[sourceAt + 1], field[sourceAt + 2]);
            outField[at] = field[sourceAt] * discount;
            outField[at + 1] = field[sourceAt + 1] * discount;
            outField[at + 2] = field[sourceAt + 2] * discount;
        }
    },
}

// One sweep along one axis, over every line of blocks running along it.
function sweepAxis(isOpen: Uint8Array, stride: number, axisLength: number, blockSize: number)
{
    // The bell curve's discount over a distance of this many blocks along the axis is this, times
    // the square of that many, subtracted from the logarithm.
    const curvature = (blockSize * blockSize) / (2 * NEARBY_LIGHT_SPREAD * NEARBY_LIGHT_SPREAD);

    const lineSpan = stride * axisLength;
    for (let spanStart = 0; spanStart < NUM_VOXEL_BLOCKS; spanStart += lineSpan)
    {
        for (let lineStart = spanStart; lineStart < spanStart + stride; ++lineStart)
        {
            // A solid block is not dark but absent: nothing is carried into it or across it, so a
            // line is swept one unbroken run of open blocks at a time.
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

// Carries light along one run of open blocks, in place.
//
// Every lit block in the run casts a parabola over the run — its own light, less the discount for
// how far along the run each other block is — and what a block ends up with is whichever parabola
// is highest over it. Those highest stretches are gathered first and read back after, which
// settles a run in one pass along it rather than by comparing every block in it with every other.
// The parabolas all bend by the same amount, so any two of them cross exactly once, and one that
// is overtaken on both sides is never highest anywhere and can be dropped for good.
function sweepRun(lineStart: number, stride: number, runStart: number, runEnd: number,
    curvature: number)
{
    let top = -1;
    for (let position = runStart; position < runEnd; ++position)
    {
        const blockIndex = lineStart + position * stride;
        const logLuminance = logLuminanceByBlock[blockIndex];
        if (logLuminance === Number.NEGATIVE_INFINITY)
            continue;

        // Where this block's parabola overtakes the one currently highest furthest along the run.
        // One that it overtakes before that one had even taken over is never highest anywhere.
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
        envelopeSources[top] = sourceByBlock[blockIndex];
        envelopeStarts[top] = (top === 0) ? Number.NEGATIVE_INFINITY : overtakesAt;
    }

    // No light anywhere along the run, so every block in it keeps the none it already holds.
    if (top < 0)
        return;

    let segment = 0;
    for (let position = runStart; position < runEnd; ++position)
    {
        while (segment < top && envelopeStarts[segment + 1] <= position)
            ++segment;
        const offset = position - envelopePositions[segment];
        const blockIndex = lineStart + position * stride;
        logLuminanceByBlock[blockIndex] = envelopeLogLuminance[segment] -
            curvature * offset * offset;
        sourceByBlock[blockIndex] = envelopeSources[segment];
    }
}

export default LightBlockDilationUtil;
