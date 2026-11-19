import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../imageMapEditor/core/imageProcessingUtil";
import PrepCutOut from "./prepCutOut";
import MaskFinder from "./maskFinder";
import CutoutUtil from "./cutoutUtil";

type Frame = [number, number, number, number];

// The room left around a thing when the model looks at it again up close, as a share of its longer side.
const FRAME_MARGIN = 0.12;
// A closer look that still takes in this share of the picture shows the model nothing new.
const MAX_CLOSER_SHARE = 0.8;
// A piece or a hole of fewer cells than this, or smaller than this share of a mask's largest piece, is noise.
const MIN_SPECK_CELLS = 4;
const SPECK_SHARE = 0.001;
// A cell kept on a logit under this is one the model was unsure of.
const FAINT_LOGIT = 1;
// A chance this near to none or to certain is taken as that, whatever its slope.
const SURE = 1e-4;
const MIN_SLOPE = 1e-4;
// The cut-out's edge runs from see-through to solid over this many pixels.
const EDGE_RAMP = 1.5;
// Parts no further apart than this share of the cut-out's longer side are joined across the gap.
const SEAM_SHARE = 0.0025;
// How far the kept colors are carried out under the edge, in pixels.
const EDGE_CARRY = 3;
// Whose a pixel is, where it is no part's.
const NOBODY = -1;
const DROPPED = -2;

// Cutting things out of a picture by what they are (see PrepCutOut): a model finds each part's mask, on the whole
// picture and then again up close, and the masks are made into the cut-out's alpha.
const MaskUtil =
{
    // The picture with everything but the parts made see-through, in its own frame, and a line on what the model
    // found for each part. What was see-through already stays so.
    cutOut: async (picture: RgbaImage, parts: PrepCutOut[], findMask: MaskFinder):
        Promise<{image: RgbaImage, notes: string[]}> =>
    {
        const {width, height} = picture;
        const count = width * height;
        // The chance that each pixel is kept, and the part it is kept as.
        const kept = new Float32Array(count);
        const owner = new Int16Array(count).fill(NOBODY);
        const notes: string[] = [];
        for (let index = 0; index < parts.length; ++index)
        {
            const part = parts[index];
            const found = await findPart(picture, part, findMask);
            if (found == undefined)
                throw new Error(`the model found nothing for part ${index + 1} of the cut-out: check its rect and points`);
            notes.push(`cut out: part ${index + 1}${part.drop ? ", dropped," : ""} ${describe(found, width, height)}`);
            flipSpecks(found.logits);
            layOn(kept, owner, width, found.frame, smooth(found.logits), part.drop ? DROPPED : index);
        }

        const alpha = toAlpha(kept, width, height);
        if (parts.filter(part => !part.drop).length > 1)
            joinSeams(alpha, owner, width, height);

        const image = ImageProcessingUtil.copyImage(picture);
        let any = false;
        for (let p = 0; p < count; ++p)
        {
            image.data[p * 4 + 3] = alpha[p] * picture.data[p * 4 + 3] / 255;
            if (image.data[p * 4 + 3] == 0)
                image.data.fill(0, p * 4, p * 4 + 3);
            else
                any = true;
        }
        if (!any)
            throw new Error("the cut-out kept nothing: its parts dropped all that was found");
        // The edge's own pixels are part background, so they take the color of what lies inside them.
        CutoutUtil.carryColors(image, EDGE_CARRY, 255);
        return {image, notes};
    },
}

// The part's mask and the frame it lies on: found on the whole picture, then again on the thing alone, where the
// grid's cells are smaller, starting from the first. Undefined if the model finds nothing.
async function findPart(picture: RgbaImage, part: PrepCutOut,
    findMask: MaskFinder): Promise<{frame: Frame, logits: Float32Array, score: number} | undefined>
{
    const whole: Frame = [0, 0, picture.width, picture.height];
    const first = await findMask(picture, whole, part);
    // A speck far from the thing would widen the closer look to take it in.
    flipSpecks(first.logits);
    const closer = getCloserFrame(first.logits, part, picture.width, picture.height);
    if (closer == undefined)
        return undefined;
    if (closer[2] * closer[3] >= MAX_CLOSER_SHARE * picture.width * picture.height)
        return {frame: whole, ...first};
    const second = await findMask(picture, closer, part, resample(first.logits, whole, closer));
    // A closer look that lost the thing is worth less than the first.
    return (getBounds(second.logits) == undefined) ? {frame: whole, ...first} : {frame: closer, ...second};
}

// The cells the mask keeps, as the smallest rectangle of the grid that holds them; undefined if it keeps none.
function getBounds(logits: Float32Array): {minX: number, minY: number, maxX: number, maxY: number} | undefined
{
    const size = Math.sqrt(logits.length);
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; ++y)
    {
        for (let x = 0; x < size; ++x)
        {
            if (logits[y * size + x] <= 0)
                continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    return (maxX < 0) ? undefined : {minX, minY, maxX, maxY};
}

// What a mask of the whole picture keeps, with the points on the thing that it left out and room around it all, in
// pixels.
function getCloserFrame(logits: Float32Array, part: PrepCutOut, width: number, height: number): Frame | undefined
{
    const bounds = getBounds(logits);
    if (bounds == undefined)
        return undefined;
    const size = Math.sqrt(logits.length);
    const across = [bounds.minX / size, (bounds.maxX + 1) / size, ...(part.on ?? []).map(([x]) => x)];
    const down = [bounds.minY / size, (bounds.maxY + 1) / size, ...(part.on ?? []).map(([, y]) => y)];
    const x0 = Math.min(...across) * width, x1 = Math.max(...across) * width;
    const y0 = Math.min(...down) * height, y1 = Math.max(...down) * height;
    const margin = FRAME_MARGIN * Math.max(x1 - x0, y1 - y0);
    const left = Math.max(0, Math.floor(x0 - margin)), top = Math.max(0, Math.floor(y0 - margin));
    return [left, top, Math.min(width, Math.ceil(x1 + margin)) - left, Math.min(height, Math.ceil(y1 + margin)) - top];
}

// Where the mask lies and how sure the model was of it.
function describe(found: {frame: Frame, logits: Float32Array, score: number}, width: number, height: number): string
{
    const [left, top, frameWidth, frameHeight] = found.frame;
    const bounds = getBounds(found.logits)!;
    const size = Math.sqrt(found.logits.length);
    let solid = 0, faint = 0;
    for (const logit of found.logits)
    {
        if (logit > 0)
            ++solid;
        if (logit > 0 && logit < FAINT_LOGIT)
            ++faint;
    }
    const across = [bounds.minX, bounds.maxX + 1].map(x => ((left + x / size * frameWidth) / width).toFixed(3));
    const down = [bounds.minY, bounds.maxY + 1].map(y => ((top + y / size * frameHeight) / height).toFixed(3));
    return `at x ${across.join("-")}, y ${down.join("-")}, scored ${found.score.toFixed(2)}, `
        + `${Math.round(100 * faint / solid)}% of it faint`;
}

// A mask on one frame's grid, as it falls on another's.
function resample(logits: Float32Array, from: Frame, to: Frame): Float32Array
{
    const size = Math.sqrt(logits.length);
    const columns = getTaps(from[0], from[2], to[0], to[2], size), rows = getTaps(from[1], from[3], to[1], to[3], size);
    const result = new Float32Array(size * size);
    for (let y = 0; y < size; ++y)
    {
        for (let x = 0; x < size; ++x)
            result[y * size + x] = sample(logits, size, columns, x, rows, y);
    }
    return result;
}

// For each of count places spread evenly over one stretch (in pixels), the four cells of a grid over another
// stretch that a smooth curve through the grid takes its value there from, and how much of each (Catmull-Rom).
function getTaps(gridStart: number, gridLength: number, start: number, length: number,
    size: number, count: number = size): {cells: Int32Array, weights: Float32Array}
{
    const cells = new Int32Array(count * 4), weights = new Float32Array(count * 4);
    for (let i = 0; i < count; ++i)
    {
        const at = (start + (i + 0.5) / count * length - gridStart) / gridLength * size - 0.5;
        const first = Math.floor(at), t = at - first;
        for (let tap = 0; tap < 4; ++tap)
            cells[i * 4 + tap] = Math.min(size - 1, Math.max(0, first - 1 + tap));
        weights.set([(-t * t * t + 2 * t * t - t) / 2, (3 * t * t * t - 5 * t * t + 2) / 2,
            (-3 * t * t * t + 4 * t * t + t) / 2, (t * t * t - t * t) / 2], i * 4);
    }
    return {cells, weights};
}

function sample(logits: Float32Array, size: number, columns: {cells: Int32Array, weights: Float32Array}, x: number,
    rows: {cells: Int32Array, weights: Float32Array}, y: number): number
{
    let value = 0;
    for (let j = 0; j < 4; ++j)
    {
        const row = rows.cells[y * 4 + j] * size;
        let line = 0;
        for (let i = 0; i < 4; ++i)
            line += columns.weights[x * 4 + i] * logits[row + columns.cells[x * 4 + i]];
        value += rows.weights[y * 4 + j] * line;
    }
    return value;
}

// Gives every piece and hole far smaller than the mask's largest piece the sign of what surrounds it: the model
// leaves such specks where it wavers, and they are too small for it to have meant.
function flipSpecks(logits: Float32Array): void
{
    const size = Math.sqrt(logits.length);
    const seen = new Uint8Array(logits.length);
    const pieces: {kept: boolean, cells: number[], atBorder: boolean}[] = [];
    for (let start = 0; start < logits.length; ++start)
    {
        if (seen[start])
            continue;
        const kept = logits[start] > 0;
        const cells = [start];
        let atBorder = false;
        seen[start] = 1;
        for (let i = 0; i < cells.length; ++i)
        {
            const p = cells[i];
            const x = p % size, y = (p - x) / size;
            atBorder = atBorder || x == 0 || y == 0 || x == size - 1 || y == size - 1;
            for (const q of [(x > 0) ? p - 1 : -1, (x < size - 1) ? p + 1 : -1, (y > 0) ? p - size : -1,
                (y < size - 1) ? p + size : -1])
            {
                if (q >= 0 && !seen[q] && (logits[q] > 0) == kept)
                {
                    seen[q] = 1;
                    cells.push(q);
                }
            }
        }
        pieces.push({kept, cells, atBorder});
    }
    const largest = pieces.reduce((most, piece) => piece.kept ? Math.max(most, piece.cells.length) : most, 0);
    // Never the largest piece itself, however small the thing is on the grid.
    const least = Math.min(largest, Math.max(MIN_SPECK_CELLS, SPECK_SHARE * largest));
    for (const piece of pieces)
    {
        // What reaches the grid's border and isn't kept is the background itself.
        if (piece.cells.length >= least || (!piece.kept && piece.atBorder))
            continue;
        for (const p of piece.cells)
            logits[p] = (piece.kept ? -1 : 1) * Math.max(FAINT_LOGIT, Math.abs(logits[p]));
    }
}

// The mask blurred by a 3x3 binomial, which answers nothing to a ripple two cells long: the one the model's own
// upscaling leaves along an edge.
function smooth(logits: Float32Array): Float32Array
{
    const size = Math.sqrt(logits.length);
    const result = new Float32Array(logits.length);
    for (let y = 0; y < size; ++y)
    {
        const above = Math.max(0, y - 1) * size, here = y * size, below = Math.min(size - 1, y + 1) * size;
        for (let x = 0; x < size; ++x)
        {
            const before = Math.max(0, x - 1), after = Math.min(size - 1, x + 1);
            result[here + x] = (logits[above + before] + 2 * logits[above + x] + logits[above + after]
                + 2 * logits[here + before] + 4 * logits[here + x] + 2 * logits[here + after]
                + logits[below + before] + 2 * logits[below + x] + logits[below + after]) / 16;
        }
    }
    return result;
}

// Adds a part's mask to what is kept, or takes it out: each pixel of its frame gets the chance the mask gives it,
// run smoothly between the grid's cells, and is the part's where that is over a half.
function layOn(kept: Float32Array, owner: Int16Array, width: number, [left, top, frameWidth, frameHeight]: Frame,
    logits: Float32Array, as: number): void
{
    const size = Math.sqrt(logits.length);
    const columns = getTaps(left, frameWidth, left, frameWidth, size, frameWidth);
    const rows = getTaps(top, frameHeight, top, frameHeight, size, frameHeight);
    for (let y = 0; y < frameHeight; ++y)
    {
        for (let x = 0; x < frameWidth; ++x)
        {
            const chance = 1 / (1 + Math.exp(-sample(logits, size, columns, x, rows, y)));
            const p = (top + y) * width + left + x;
            // Two parts that each half claim a pixel keep it between them.
            kept[p] = (as == DROPPED) ? kept[p] * (1 - chance) : 1 - (1 - kept[p]) * (1 - chance);
            if (chance >= 0.5)
                owner[p] = as;
        }
    }
}

// A crisp edge where the chance crosses a half: each pixel is as solid as it lies inside that line, going by how
// fast the chance changes there.
function toAlpha(kept: Float32Array, width: number, height: number): Uint8ClampedArray
{
    const alpha = new Uint8ClampedArray(kept.length);
    for (let y = 0; y < height; ++y)
    {
        for (let x = 0; x < width; ++x)
        {
            const p = y * width + x;
            const chance = kept[p];
            if (chance < SURE)
                continue;
            if (chance > 1 - SURE)
            {
                alpha[p] = 255;
                continue;
            }
            const across = (kept[(x < width - 1) ? p + 1 : p] - kept[(x > 0) ? p - 1 : p]) / 2;
            const down = (kept[(y < height - 1) ? p + width : p] - kept[(y > 0) ? p - width : p]) / 2;
            const depth = (chance - 0.5) / Math.max(MIN_SLOPE, Math.hypot(across, down));
            alpha[p] = 255 * Math.min(1, Math.max(0, 0.5 + depth / EDGE_RAMP));
        }
    }
    return alpha;
}

// Makes solid whatever lies within reach of two parts at once: each mask stops a little short of where the two
// meet, which would leave a see-through hairline between things that touch.
function joinSeams(alpha: Uint8ClampedArray, owner: Int16Array, width: number, height: number): void
{
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; ++y)
    {
        for (let x = 0; x < width; ++x)
        {
            if (owner[y * width + x] < 0)
                continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    if (maxX < 0)
        return;
    const reach = Math.max(1, Math.round(SEAM_SHARE * Math.max(maxX - minX + 1, maxY - minY + 1)));
    const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1;

    // The lowest and the highest part within reach along each row, then along each column of those.
    const lowAcross = new Int16Array(boxWidth * boxHeight), highAcross = new Int16Array(boxWidth * boxHeight);
    for (let y = 0; y < boxHeight; ++y)
    {
        for (let x = 0; x < boxWidth; ++x)
        {
            let low = Infinity, high = NOBODY;
            for (let near = Math.max(0, x - reach); near <= Math.min(boxWidth - 1, x + reach); ++near)
            {
                const part = owner[(minY + y) * width + minX + near];
                if (part < 0)
                    continue;
                low = Math.min(low, part);
                high = Math.max(high, part);
            }
            lowAcross[y * boxWidth + x] = (high < 0) ? NOBODY : low;
            highAcross[y * boxWidth + x] = high;
        }
    }
    const joined: number[] = [];
    for (let y = 0; y < boxHeight; ++y)
    {
        for (let x = 0; x < boxWidth; ++x)
        {
            let low = Infinity, high = NOBODY;
            for (let near = Math.max(0, y - reach); near <= Math.min(boxHeight - 1, y + reach); ++near)
            {
                if (highAcross[near * boxWidth + x] < 0)
                    continue;
                low = Math.min(low, lowAcross[near * boxWidth + x]);
                high = Math.max(high, highAcross[near * boxWidth + x]);
            }
            const p = (minY + y) * width + minX + x;
            if (high >= 0 && low != high && owner[p] != DROPPED)
                joined.push(p);
        }
    }

    // Each part's own edge fades toward the gap, so it is made solid along it as well.
    const spread = Math.ceil(EDGE_RAMP);
    for (const p of joined)
    {
        alpha[p] = 255;
        const x = p % width, y = (p - x) / width;
        for (let ny = Math.max(0, y - spread); ny <= Math.min(height - 1, y + spread); ++ny)
        {
            for (let nx = Math.max(0, x - spread); nx <= Math.min(width - 1, x + spread); ++nx)
            {
                if (owner[ny * width + nx] >= 0)
                    alpha[ny * width + nx] = 255;
            }
        }
    }
}

export default MaskUtil;
