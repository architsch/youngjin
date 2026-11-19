import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../imageMapEditor/core/imageProcessingUtil";
import SelectionGeometryUtil from "../../imageMapEditor/core/selectionGeometryUtil";
import PrepCover from "./prepCover";

// A color with its alpha, or nothing where no surface is to be had.
type Surface = (x: number, y: number) => number[] | undefined;

// The band inside a part's edge over which the new surface fades into what was there, and the band outside it that
// the new surface is matched to, as a share of the picture's longer side. Narrow, so a part can be set between the
// thing it covers and whatever lies close by.
const BAND_SHARE = 0.006;
// The ring is compared patch by patch: each as wide as the ring or this many pixels, and no more than so many of
// them (wider ones around a long edge). A patch of fewer pixels than this says too little to count.
const MIN_PATCH_SIZE = 6;
const MAX_PATCHES = 256;
const MIN_PATCH_PIXELS = 6;
// The shading changes slowly, so it is worked out on a grid this coarse, in pixels.
const SHADING_STEP = 4;
const SOLID_ALPHA = 128;

// Painting a part of a picture over with surface from elsewhere in it (see PrepCover).
const CoverUtil =
{
    // The picture with the part painted over, and how the painting went: how many patches of the part's surroundings
    // a surface brought from elsewhere was shaded by, and how many of the part's pixels no surface was to be had for,
    // which stay as they were.
    paintOver: (image: RgbaImage, cover: PrepCover): {image: RgbaImage, patches: number, unsourced: number} =>
    {
        const {width, height} = image;
        const band = Math.max(2, BAND_SHARE * Math.max(width, height));
        const depthAt = getDepth(cover, width, height);
        const [rx, ry, rw, rh] = cover.rect;
        // The part and the ring around it, as far as they lie on the picture.
        const x0 = clamp(Math.floor(rx * width - band), 0, width);
        const x1 = clamp(Math.ceil((rx + rw) * width + band), 0, width);
        const y0 = clamp(Math.floor(ry * height - band), 0, height);
        const y1 = clamp(Math.ceil((ry + rh) * height + band), 0, height);
        const result = ImageProcessingUtil.copyImage(image);
        if (x1 <= x0 || y1 <= y0)
            return {image: result, patches: 0, unsourced: 0};

        let surface: Surface;
        let patches = 0;
        if (cover.from == "across" || cover.from == "down")
        {
            surface = getBridge(image, depthAt, band, x0, y0, x1, y1, cover.from == "down");
        }
        else
        {
            const copied = getCopy(image, cover, depthAt, band, x0, y0, x1, y1);
            surface = copied.surface;
            patches = copied.patches;
        }

        const from = image.data, to = result.data;
        let unsourced = 0;
        for (let y = y0; y < y1; ++y)
        {
            for (let x = x0; x < x1; ++x)
            {
                const depth = depthAt(x + 0.5, y + 0.5);
                if (depth <= 0)
                    continue;
                const index = (y * width + x) * 4;
                const brought = surface(x, y);
                if (brought == undefined)
                {
                    if (from[index + 3] > 0)
                        ++unsourced;
                    continue;
                }
                const t = Math.min(1, depth / band);
                const weight = t * t * (3 - 2 * t);
                // Blended by what each side shows, so nothing of a color hidden under transparency comes through.
                const here = from[index + 3] * (1 - weight), there = brought[3] * weight;
                for (let channel = 0; channel < 3 && here + there > 0; ++channel)
                    to[index + channel] = (from[index + channel] * here + brought[channel] * there) / (here + there);
                to[index + 3] = here + there;
            }
        }
        return {image: result, patches, unsourced};
    },
}

// How far inside the part's edge a point is, in pixels; negative outside it. Near enough along an ellipse's edge.
function getDepth(cover: PrepCover, width: number, height: number): (x: number, y: number) => number
{
    const {cx, cy, halfWidth, halfHeight} = SelectionGeometryUtil.getFrame(
        {shape: cover.shape, rect: cover.rect, radius: cover.radius ?? 0}, width, height);
    const shorter = Math.min(halfWidth, halfHeight);
    if (cover.shape == "ellipse")
        return (x, y) => (1 - Math.hypot((x - cx) / halfWidth, (y - cy) / halfHeight)) * shorter;
    const r = clamp(cover.radius ?? 0, 0, 0.5) * 2 * shorter;
    return (x, y) => {
        const qx = Math.abs(x - cx) - (halfWidth - r), qy = Math.abs(y - cy) - (halfHeight - r);
        return r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
    };
}

// The surface of another region (the part's mirror, or the one named), shaded to match the part's surroundings.
function getCopy(image: RgbaImage, cover: PrepCover, depthAt: (x: number, y: number) => number, ring: number,
    x0: number, y0: number, x1: number, y1: number): {surface: Surface, patches: number}
{
    const {width, height, data} = image;
    let sourceOf: (x: number, y: number) => number;
    if (cover.from == "mirror")
    {
        sourceOf = (x, y) => y * width + (width - 1 - x);
    }
    else
    {
        const [fromX, fromY] = cover.from as [number, number];
        const dx = Math.round((fromX - cover.rect[0]) * width), dy = Math.round((fromY - cover.rect[1]) * height);
        sourceOf = (x, y) => {
            const sx = x + dx, sy = y + dy;
            return (sx < 0 || sy < 0 || sx >= width || sy >= height) ? -1 : sy * width + sx;
        };
    }
    const patches = getPatches(image, depthAt, sourceOf, ring, x0, y0, x1, y1);
    const shading = getShading(patches, x0, y0, x1, y1);
    return {
        patches: patches.length,
        surface: (x, y) => {
            const source = sourceOf(x, y) * 4;
            if (source < 0)
                return undefined;
            const shade = shading(x, y);
            return [clamp(data[source] + shade[0], 0, 255), clamp(data[source + 1] + shade[1], 0, 255),
                clamp(data[source + 2] + shade[2], 0, 255), data[source + 3]];
        },
    };
}

// What the part's surroundings show against the surroundings of where its new surface comes from: for each patch of
// the ring just outside the part, where it lies and the usual difference of the two there, per channel.
function getPatches(image: RgbaImage, depthAt: (x: number, y: number) => number, sourceOf: (x: number, y: number) => number,
    ring: number, x0: number, y0: number, x1: number, y1: number): {x: number, y: number, shade: number[]}[]
{
    const {width, data} = image;
    const size = Math.max(ring, MIN_PATCH_SIZE, 2 * (x1 - x0 + y1 - y0) / MAX_PATCHES);
    const columns = Math.ceil((x1 - x0) / size);
    const cells = new Map<number, {x: number, y: number, differences: number[][]}>();
    for (let y = y0; y < y1; ++y)
    {
        for (let x = x0; x < x1; ++x)
        {
            const depth = depthAt(x + 0.5, y + 0.5);
            if (depth > 0 || depth < -ring)
                continue;
            const index = (y * width + x) * 4, source = sourceOf(x, y) * 4;
            if (source < 0 || data[index + 3] < SOLID_ALPHA || data[source + 3] < SOLID_ALPHA)
                continue;
            const key = Math.floor((y - y0) / size) * columns + Math.floor((x - x0) / size);
            let cell = cells.get(key);
            if (cell == undefined)
                cells.set(key, cell = {x: 0, y: 0, differences: [[], [], []]});
            cell.x += x;
            cell.y += y;
            for (let channel = 0; channel < 3; ++channel)
                cell.differences[channel].push(data[index + channel] - data[source + channel]);
        }
    }
    // The middle one of a patch's differences, so a thin line or a speck crossing it doesn't count.
    return [...cells.values()].filter(cell => cell.differences[0].length >= MIN_PATCH_PIXELS).map(cell => ({
        x: cell.x / cell.differences[0].length,
        y: cell.y / cell.differences[0].length,
        shade: cell.differences.map(median),
    }));
}

// How much lighter or darker the surface brought in is made at each pixel, per channel: the patches' differences,
// each counting by its nearness, so the surface meets its surroundings on every side.
function getShading(patches: {x: number, y: number, shade: number[]}[], x0: number, y0: number, x1: number,
    y1: number): (x: number, y: number) => number[]
{
    if (patches.length == 0)
        return () => [0, 0, 0];
    const columns = Math.ceil((x1 - x0) / SHADING_STEP) + 1, rows = Math.ceil((y1 - y0) / SHADING_STEP) + 1;
    const grid = new Float32Array(columns * rows * 3);
    for (let row = 0; row < rows; ++row)
    {
        for (let column = 0; column < columns; ++column)
        {
            const x = x0 + column * SHADING_STEP, y = y0 + row * SHADING_STEP;
            let total = 0, r = 0, g = 0, b = 0;
            for (const patch of patches)
            {
                const distanceSq = (patch.x - x) ** 2 + (patch.y - y) ** 2 + 1;
                const weight = 1 / (distanceSq * Math.sqrt(distanceSq));
                total += weight;
                r += weight * patch.shade[0];
                g += weight * patch.shade[1];
                b += weight * patch.shade[2];
            }
            grid.set([r / total, g / total, b / total], (row * columns + column) * 3);
        }
    }
    return (x, y) => {
        const gx = (x - x0) / SHADING_STEP, gy = (y - y0) / SHADING_STEP;
        const column = Math.min(columns - 2, Math.floor(gx)), row = Math.min(rows - 2, Math.floor(gy));
        const tx = gx - column, ty = gy - row;
        const at = (c: number, r: number, channel: number) => grid[(r * columns + c) * 3 + channel];
        return [0, 1, 2].map(channel => (at(column, row, channel) * (1 - tx) + at(column + 1, row, channel) * tx) * (1 - ty)
            + (at(column, row + 1, channel) * (1 - tx) + at(column + 1, row + 1, channel) * tx) * ty);
    };
}

// The surface a plain stretch would show across the part: along each line of pixels through it (a row; a column
// when it runs down), the colors found just outside its two ends, running from the one to the other. Where only
// one end has any, that one's throughout. Each end's color is taken over a band's width, and over a few lines
// either side: enough that no single line's grain streaks across, and few enough that an edge the lines run along
// stays as crisp as it is beside the part.
function getBridge(image: RgbaImage, depthAt: (x: number, y: number) => number, band: number, x0: number, y0: number,
    x1: number, y1: number, down: boolean): Surface
{
    const {width, height, data} = image;
    const reach = Math.ceil(band), spread = Math.max(1, Math.round(band / 3));
    const lineStart = down ? x0 : y0, lineEnd = down ? x1 : y1;
    const alongStart = down ? y0 : x0, alongEnd = down ? y1 : x1;
    const lineLimit = down ? width : height, alongLimit = down ? height : width;
    const toIndex = (line: number, along: number) => (down ? along * width + line : line * width + along) * 4;
    const inPart = (line: number, along: number) =>
        (down ? depthAt(line + 0.5, along + 0.5) : depthAt(along + 0.5, line + 0.5)) > 0;

    // The mean solid color outside the part, over the pixels from..to along the lines around this one.
    const sample = (line: number, from: number, to: number): number[] | undefined => {
        let r = 0, g = 0, b = 0, n = 0;
        for (let l = Math.max(0, line - spread); l <= Math.min(lineLimit - 1, line + spread); ++l)
        {
            for (let a = Math.max(0, from); a <= Math.min(alongLimit - 1, to); ++a)
            {
                const index = toIndex(l, a);
                if (data[index + 3] < SOLID_ALPHA || inPart(l, a))
                    continue;
                r += data[index];
                g += data[index + 1];
                b += data[index + 2];
                ++n;
            }
        }
        return (n > 0) ? [r / n, g / n, b / n] : undefined;
    };

    const lines: ({first: number, last: number, before?: number[], after?: number[]} | undefined)[] = [];
    for (let line = lineStart; line < lineEnd; ++line)
    {
        let first = -1, last = -1;
        for (let along = alongStart; along < alongEnd; ++along)
        {
            if (!inPart(line, along))
                continue;
            if (first < 0)
                first = along;
            last = along;
        }
        lines.push((first < 0) ? undefined
            : {first, last, before: sample(line, first - reach, first - 1), after: sample(line, last + 1, last + reach)});
    }

    return (x, y) => {
        const found = lines[(down ? x : y) - lineStart];
        const before = found?.before ?? found?.after, after = found?.after ?? found?.before;
        if (found == undefined || before == undefined || after == undefined)
            return undefined;
        const t = ((down ? y : x) - found.first) / Math.max(1, found.last - found.first);
        return [before[0] + (after[0] - before[0]) * t, before[1] + (after[1] - before[1]) * t,
            before[2] + (after[2] - before[2]) * t, 255];
    };
}

function median(values: number[]): number
{
    if (values.length == 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return (sorted.length % 2 == 1) ? sorted[middle] : 0.5 * (sorted[middle - 1] + sorted[middle]);
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default CoverUtil;
