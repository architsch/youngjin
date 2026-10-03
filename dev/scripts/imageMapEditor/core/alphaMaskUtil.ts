import RgbaImage from "./rgbaImage";
import ImageRecipe from "./imageRecipe";
import RecipeBackground from "./recipeBackground";
import RecipeSelection from "./recipeSelection";
import RecipeAlphaEdit from "./recipeAlphaEdit";
import LabColorUtil from "./labColorUtil";
import SelectionGeometryUtil from "./selectionGeometryUtil";

// How much of the border, around each of its pixels, is the color that pixel is compared against when the fill
// starts from the border: a median, so a gradient is followed but an object touching the edge isn't taken for it.
const BORDER_WINDOW_FRACTION = 0.1;

// What of a sample is kept (see ImageRecipe): its background taken out and edited by hand, then cut to the
// selections. A pixel outside any see-through selection is taken out, whatever else would keep it (so two
// selections cut out where they overlap: a square and the same square turned by 45° make an octagon); one outside a
// selection that fills, and inside every see-through one, is filled.
const AlphaMaskUtil =
{
    // One per pixel, 1 where kept; undefined when the recipe takes nothing out. Colors are compared as the sample
    // is before any color adjustment. What is to be filled is kept (see fillOutside).
    getKeepMask: (sample: RgbaImage, recipe: ImageRecipe): Uint8Array | undefined =>
    {
        const edits = recipe.alphaEdits ?? [];
        const selections = recipe.selections ?? [];
        if (recipe.background == undefined && !selections.some(selection => selection.fill == undefined)
            && edits.length == 0)
            return undefined;

        const {width, height} = sample;
        const lab = (recipe.background != undefined || edits.some(edit => edit.kind == "eraseColor"))
            ? LabColorUtil.toLab(sample) : undefined;
        const keep = new Uint8Array(width * height).fill(1);
        if (recipe.background != undefined)
        {
            const background = AlphaMaskUtil.findBackground(sample, lab!, recipe.background);
            for (let i = 0; i < keep.length; ++i)
                keep[i] = background[i] ? 0 : 1;
        }
        for (const edit of edits)
            applyEdit(keep, width, height, lab, edit);
        if (selections.length > 0)
        {
            const tests = getSelectionTests(selections, width, height);
            for (let y = 0; y < height; ++y)
            {
                for (let x = 0; x < width; ++x)
                {
                    const outcome = getOutcome(tests, x, y);
                    if (outcome != "inside")
                        keep[y * width + x] = (outcome == "takenOut") ? 0 : 1;
                }
            }
        }
        return keep;
    },

    // What lies outside a selection that fills (and inside every see-through one) becomes its fill color, opaque:
    // the last such selection's in the list, where several reach a pixel.
    fillOutside: (image: RgbaImage, selections: RecipeSelection[]): void =>
    {
        if (!selections.some(selection => selection.fill != undefined))
            return;
        const tests = getSelectionTests(selections, image.width, image.height);
        for (let y = 0; y < image.height; ++y)
        {
            for (let x = 0; x < image.width; ++x)
            {
                const outcome = getOutcome(tests, x, y);
                if (outcome != "inside" && outcome != "takenOut")
                    image.data.set(outcome, (y * image.width + x) * 4);
            }
        }
    },

    // One per pixel: 1 where the background is (see RecipeBackground).
    findBackground: (image: RgbaImage, lab: Float32Array, background: RecipeBackground): Uint8Array =>
    {
        const {width, height} = image;
        const count = width * height;
        const result = new Uint8Array(count);
        // Which start each reached pixel was reached from, and each start's color.
        const origin = new Int32Array(count).fill(-1);
        const references: number[] = [];
        const stack = new Int32Array(count);
        let top = 0;

        const start = (index: number, color: ArrayLike<number>) => {
            if (origin[index] >= 0 || LabColorUtil.distanceTo(lab, index, color, 0) > background.tolerance)
                return;
            origin[index] = references.length / 3;
            references.push(color[0], color[1], color[2]);
            stack[top++] = index;
        };
        if (background.fromBorder)
        {
            const border = getBorderIndices(width, height);
            const medians = getBorderMedians(image, border);
            for (let i = 0; i < border.length; ++i)
                start(border[i], LabColorUtil.fromRgb(medians[i * 3], medians[i * 3 + 1], medians[i * 3 + 2]));
        }
        for (const [u, v] of background.seeds)
        {
            const index = clamp(Math.floor(v * height), 0, height - 1) * width + clamp(Math.floor(u * width), 0, width - 1);
            start(index, lab.subarray(index * 3, index * 3 + 3));
        }

        const visit = (from: number, to: number) => {
            if (origin[to] >= 0 || LabColorUtil.distanceTo(lab, to, references, origin[from] * 3) > background.tolerance)
                return;
            if (background.step != undefined && LabColorUtil.distance(lab, from, to) > background.step)
                return;
            origin[to] = origin[from];
            stack[top++] = to;
        };
        while (top > 0)
        {
            const index = stack[--top];
            result[index] = 1;
            const x = index % width;
            if (x > 0)
                visit(index, index - 1);
            if (x < width - 1)
                visit(index, index + 1);
            if (index >= width)
                visit(index, index - width);
            if (index < count - width)
                visit(index, index + width);
        }
        if (background.keepLargest)
            keepLargestForeground(result, width, height);
        return result;
    },

    // What isn't kept becomes transparent: hard-edged, since the game cuts pictures out rather than blending them.
    cutOut: (image: RgbaImage, keep: Uint8Array): void =>
    {
        for (let i = 0; i < keep.length; ++i)
        {
            if (!keep[i])
                image.data[i * 4 + 3] = 0;
        }
    },
}

function applyEdit(keep: Uint8Array, width: number, height: number, lab: Float32Array | undefined,
    edit: RecipeAlphaEdit): void
{
    if (edit.kind == "eraseColor")
    {
        const start = clamp(Math.floor(edit.point[1] * height), 0, height - 1) * width
            + clamp(Math.floor(edit.point[0] * width), 0, width - 1);
        const color = lab!.slice(start * 3, start * 3 + 3);
        // Taking a pixel out also marks it reached, so each is stacked once.
        const stack = new Int32Array(keep.length);
        let top = 0;
        const visit = (index: number) => {
            if (keep[index] && LabColorUtil.distanceTo(lab!, index, color, 0) <= edit.tolerance)
            {
                keep[index] = 0;
                stack[top++] = index;
            }
        };
        visit(start);
        while (top > 0)
        {
            const index = stack[--top];
            const x = index % width;
            if (x > 0)
                visit(index - 1);
            if (x < width - 1)
                visit(index + 1);
            if (index >= width)
                visit(index - width);
            if (index < keep.length - width)
                visit(index + width);
        }
        return;
    }

    // Each segment of the stroke as a capsule of the brush's radius.
    const value = (edit.kind == "restore") ? 1 : 0;
    const radius = Math.max(0.5, edit.radius * Math.min(width, height));
    const points = edit.points.map(([u, v]) => [u * width, v * height]);
    for (let i = 0; i < points.length; ++i)
    {
        const [ax, ay] = points[i];
        const [bx, by] = points[Math.min(i + 1, points.length - 1)];
        const x0 = clamp(Math.floor(Math.min(ax, bx) - radius), 0, width - 1);
        const x1 = clamp(Math.ceil(Math.max(ax, bx) + radius), 0, width - 1);
        const y0 = clamp(Math.floor(Math.min(ay, by) - radius), 0, height - 1);
        const y1 = clamp(Math.ceil(Math.max(ay, by) + radius), 0, height - 1);
        const dx = bx - ax, dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        for (let y = y0; y <= y1; ++y)
        {
            for (let x = x0; x <= x1; ++x)
            {
                const px = x + 0.5 - ax, py = y + 0.5 - ay;
                const t = (lengthSq == 0) ? 0 : clamp((px * dx + py * dy) / lengthSq, 0, 1);
                const ex = px - t * dx, ey = py - t * dy;
                if (ex * ex + ey * ey <= radius * radius)
                    keep[y * width + x] = value;
            }
        }
    }
}

// Clockwise from the top-left corner.
function getBorderIndices(width: number, height: number): number[]
{
    const indices: number[] = [];
    for (let x = 0; x < width; ++x)
        indices.push(x);
    for (let y = 1; y < height; ++y)
        indices.push(y * width + width - 1);
    for (let x = width - 2; x >= 0 && height > 1; --x)
        indices.push((height - 1) * width + x);
    for (let y = height - 2; y > 0 && width > 1; --y)
        indices.push(y * width);
    return indices;
}

// Each border pixel's surroundings along the border, as the median of each channel (RGB, three per pixel).
function getBorderMedians(image: RgbaImage, border: number[]): Uint8Array
{
    const count = border.length;
    const half = Math.max(1, Math.round(0.5 * BORDER_WINDOW_FRACTION * count));
    const windowSize = Math.min(count, 2 * half + 1);
    const histograms = [new Int32Array(256), new Int32Array(256), new Int32Array(256)];
    const channelAt = (i: number, channel: number) => image.data[border[((i % count) + count) % count] * 4 + channel];
    for (let i = -half; i < windowSize - half; ++i)
        for (let channel = 0; channel < 3; ++channel)
            ++histograms[channel][channelAt(i, channel)];

    const medians = new Uint8Array(count * 3);
    for (let i = 0; i < count; ++i)
    {
        for (let channel = 0; channel < 3; ++channel)
        {
            const histogram = histograms[channel];
            let seen = 0, value = 0;
            while (value < 255 && (seen += histogram[value]) * 2 < windowSize)
                ++value;
            medians[i * 3 + channel] = value;
        }
        if (windowSize < count)
        {
            for (let channel = 0; channel < 3; ++channel)
            {
                --histograms[channel][channelAt(i - half, channel)];
                ++histograms[channel][channelAt(i - half + windowSize, channel)];
            }
        }
    }
    return medians;
}

// Everything but the largest region the background leaves becomes background too.
function keepLargestForeground(background: Uint8Array, width: number, height: number): void
{
    const count = width * height;
    const regionIds = new Int32Array(count).fill(-1);
    const stack = new Int32Array(count);
    let largestId = -1;
    let largestSize = 0;
    for (let start = 0; start < count; ++start)
    {
        if (background[start] || regionIds[start] != -1)
            continue;
        let size = 0;
        let top = 0;
        regionIds[start] = start;
        stack[top++] = start;
        const visit = (to: number) => {
            if (!background[to] && regionIds[to] == -1)
            {
                regionIds[to] = start;
                stack[top++] = to;
            }
        };
        while (top > 0)
        {
            const index = stack[--top];
            ++size;
            const x = index % width;
            if (x > 0)
                visit(index - 1);
            if (x < width - 1)
                visit(index + 1);
            if (index >= width)
                visit(index - width);
            if (index < count - width)
                visit(index + width);
        }
        if (size > largestSize)
        {
            largestSize = size;
            largestId = start;
        }
    }
    for (let i = 0; i < count; ++i)
    {
        if (regionIds[i] != largestId)
            background[i] = 1;
    }
}

// Each selection's test of whether a pixel's centre lies inside it, with the color it fills outside with, if any.
function getSelectionTests(selections: RecipeSelection[], width: number,
    height: number): {inside: (x: number, y: number) => boolean, fill?: [number, number, number, number]}[]
{
    return selections.map(selection => ({inside: SelectionGeometryUtil.getTest(selection, width, height),
        fill: (selection.fill != undefined) ? parseHexColor(selection.fill) : undefined}));
}

// What the selections make of a pixel: kept as it is, taken out, or filled with a color.
function getOutcome(tests: ReturnType<typeof getSelectionTests>, x: number,
    y: number): "inside" | "takenOut" | [number, number, number, number]
{
    let fill: [number, number, number, number] | undefined;
    for (const test of tests)
    {
        if (test.inside(x + 0.5, y + 0.5))
            continue;
        if (test.fill == undefined)
            return "takenOut";
        fill = test.fill;
    }
    return fill ?? "inside";
}

function parseHexColor(hex: string): [number, number, number, number]
{
    const value = parseInt(hex.replace("#", ""), 16) || 0;
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default AlphaMaskUtil;
