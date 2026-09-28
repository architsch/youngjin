import RgbaImage from "./rgbaImage";

// A pixel of the result may average up to this many source samples across, when the quad is much larger.
const MAX_SUPERSAMPLING = 4;
// A quad at most this much larger than the result is sampled once per pixel.
const SUPERSAMPLING_SLACK = 0.25;
// The band along a sample's edges whose average color fills an opaque game image's margins.
const MARGIN_BAND_FRACTION = 0.02;

// From a sample's pixels to its source's (see getSampleToSource): the quad's projective map, after turning
// about the sample's middle.
type SampleToSource = {a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number,
    cos: number, sin: number, width: number, height: number};

// The steps a sample is made by (see SampleRenderUtil), on plain RGBA pixels so the page and Node run the same
// code.
const ImageProcessingUtil =
{
    createImage: (width: number, height: number): RgbaImage =>
    {
        return {width, height, data: new Uint8ClampedArray(width * height * 4)};
    },

    copyImage: (image: RgbaImage): RgbaImage =>
    {
        return {width: image.width, height: image.height, data: new Uint8ClampedArray(image.data)};
    },

    // Samples the quad (corners in the source's pixels: top-left, top-right, bottom-right, bottom-left) onto a
    // width x height image, straightening it (a projective map) and turning the picture clockwise by rotation
    // degrees about its middle. A turned picture's corners show more of the source; past the source's edge its
    // edge pixels carry on. Each pixel averages several source samples when the quad is much larger than the
    // result, so fine patterns don't alias.
    warp: (source: RgbaImage, corners: [number, number][], width: number, height: number,
        rotation: number = 0): RgbaImage =>
    {
        const {a, b, c, d, e, f, g, h, cos, sin} = getSampleToSource(corners, width, height, rotation);
        const quadWidth = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
        const quadHeight = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
        const ratio = Math.max(quadWidth / width, quadHeight / height);
        const n = Math.min(MAX_SUPERSAMPLING, Math.max(1, Math.ceil(ratio - SUPERSAMPLING_SLACK)));

        const result = ImageProcessingUtil.createImage(width, height);
        const out = result.data;
        const src = source.data;
        const sourceWidth = source.width;
        const maxX = source.width - 1, maxY = source.height - 1;
        const halfWidth = 0.5 * width, halfHeight = 0.5 * height;
        const cu = cos / width, su = sin / width, cv = cos / height, sv = sin / height;
        const weight = 1 / (n * n);
        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                let r = 0, gr = 0, bl = 0, al = 0;
                for (let sy = 0; sy < n; ++sy)
                {
                    const py = y + (sy + 0.5) / n - halfHeight;
                    for (let sx = 0; sx < n; ++sx)
                    {
                        const px = x + (sx + 0.5) / n - halfWidth;
                        // Turned back to where the picture's pixel was, then through the quad.
                        const u = px * cu + py * su + 0.5;
                        const v = py * cv - px * sv + 0.5;
                        const inverseW = 1 / (g * u + h * v + 1);
                        let fx = (a * u + b * v + c) * inverseW - 0.5;
                        let fy = (d * u + e * v + f) * inverseW - 0.5;
                        fx = (fx < 0) ? 0 : (fx > maxX) ? maxX : fx;
                        fy = (fy < 0) ? 0 : (fy > maxY) ? maxY : fy;
                        const x0 = fx | 0, y0 = fy | 0;
                        const x1 = (x0 < maxX) ? x0 + 1 : x0, y1 = (y0 < maxY) ? y0 + 1 : y0;
                        const tx = fx - x0, ty = fy - y0;
                        const i00 = (y0 * sourceWidth + x0) * 4, i01 = (y0 * sourceWidth + x1) * 4;
                        const i10 = (y1 * sourceWidth + x0) * 4, i11 = (y1 * sourceWidth + x1) * 4;
                        const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
                        r += src[i00] * w00 + src[i01] * w01 + src[i10] * w10 + src[i11] * w11;
                        gr += src[i00 + 1] * w00 + src[i01 + 1] * w01 + src[i10 + 1] * w10 + src[i11 + 1] * w11;
                        bl += src[i00 + 2] * w00 + src[i01 + 2] * w01 + src[i10 + 2] * w10 + src[i11 + 2] * w11;
                        al += src[i00 + 3] * w00 + src[i01 + 3] * w01 + src[i10 + 3] * w10 + src[i11 + 3] * w11;
                    }
                }
                const index = (y * width + x) * 4;
                out[index] = r * weight;
                out[index + 1] = gr * weight;
                out[index + 2] = bl * weight;
                out[index + 3] = al * weight;
            }
        }
        return result;
    },

    // Where a point of a width x height sample (in its pixels) comes from in the source (in its pixels), as warp
    // samples it.
    mapSampleToSource: (corners: [number, number][], width: number, height: number, rotation: number,
        x: number, y: number): [number, number] =>
    {
        const {a, b, c, d, e, f, g, h, cos, sin} = getSampleToSource(corners, width, height, rotation);
        const px = x - 0.5 * width, py = y - 0.5 * height;
        const u = (px * cos + py * sin) / width + 0.5;
        const v = (py * cos - px * sin) / height + 0.5;
        const w = g * u + h * v + 1;
        return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
    },

    // Paints over a rect (x, y, width, height in pixels; e.g. a logo) by blending the pixels just outside its four
    // edges, weighted by nearness, so a flat or gently shaded surface continues across it; then softens it, so
    // texture along the edges doesn't streak across the fill.
    fillFromEdges: (image: RgbaImage, rect: [number, number, number, number]): void =>
    {
        const [x, y, w, h] = rect;
        const x0 = clamp(Math.round(x), 1, image.width - 2);
        const x1 = clamp(Math.round(x + w), x0 + 1, image.width - 1);
        const y0 = clamp(Math.round(y), 1, image.height - 2);
        const y1 = clamp(Math.round(y + h), y0 + 1, image.height - 1);
        const original = new Uint8ClampedArray(image.data);
        const at = (px: number, py: number, channel: number) => original[(py * image.width + px) * 4 + channel];
        for (let py = y0; py < y1; ++py)
        {
            for (let px = x0; px < x1; ++px)
            {
                const weights = [1 / (px - x0 + 1), 1 / (x1 - px), 1 / (py - y0 + 1), 1 / (y1 - py)];
                const total = weights[0] + weights[1] + weights[2] + weights[3];
                for (let channel = 0; channel < 4; ++channel)
                {
                    const value = at(x0 - 1, py, channel) * weights[0] + at(x1, py, channel) * weights[1]
                        + at(px, y0 - 1, channel) * weights[2] + at(px, y1, channel) * weights[3];
                    image.data[(py * image.width + px) * 4 + channel] = value / total;
                }
            }
        }
        const radius = Math.max(1, Math.round(Math.min(x1 - x0, y1 - y0) / 4));
        for (let pass = 0; pass < 2; ++pass)
        {
            boxBlurWithinRect(image, x0, y0, x1, y1, radius, true);
            boxBlurWithinRect(image, x0, y0, x1, y1, radius, false);
        }
    },

    // Area-averaged to a smaller size, weighting colors by opacity so a cut-out's edge doesn't take on its
    // background's color.
    downscale: (image: RgbaImage, width: number, height: number): RgbaImage =>
    {
        const result = ImageProcessingUtil.createImage(width, height);
        const scaleX = image.width / width;
        const scaleY = image.height / height;
        for (let y = 0; y < height; ++y)
        {
            const fromY = y * scaleY;
            const toY = (y + 1) * scaleY;
            for (let x = 0; x < width; ++x)
            {
                const fromX = x * scaleX;
                const toX = (x + 1) * scaleX;
                let r = 0, g = 0, b = 0, a = 0, area = 0;
                for (let sy = Math.floor(fromY); sy < Math.min(image.height, Math.ceil(toY)); ++sy)
                {
                    const coverY = Math.min(toY, sy + 1) - Math.max(fromY, sy);
                    for (let sx = Math.floor(fromX); sx < Math.min(image.width, Math.ceil(toX)); ++sx)
                    {
                        const cover = coverY * (Math.min(toX, sx + 1) - Math.max(fromX, sx));
                        const index = (sy * image.width + sx) * 4;
                        const alpha = image.data[index + 3] * cover;
                        r += image.data[index] * alpha;
                        g += image.data[index + 1] * alpha;
                        b += image.data[index + 2] * alpha;
                        a += alpha;
                        area += cover;
                    }
                }
                const index = (y * width + x) * 4;
                if (a > 0)
                {
                    result.data[index] = r / a;
                    result.data[index + 1] = g / a;
                    result.data[index + 2] = b / a;
                }
                result.data[index + 3] = (area > 0) ? a / area : 0;
            }
        }
        return result;
    },

    hasTransparency: (image: RgbaImage): boolean =>
    {
        for (let i = 3; i < image.data.length; i += 4)
        {
            if (image.data[i] < 255)
                return true;
        }
        return false;
    },

    // What a game image's margins are filled with around its sample: see-through if any of the sample is, and
    // otherwise the average color along its edges, so the sample looks to carry on.
    getMarginColor: (image: RgbaImage): [number, number, number, number] =>
    {
        if (ImageProcessingUtil.hasTransparency(image))
            return [0, 0, 0, 0];
        const {width, height, data} = image;
        const band = Math.max(1, Math.round(MARGIN_BAND_FRACTION * Math.min(width, height)));
        let r = 0, g = 0, b = 0, count = 0;
        for (let y = 0; y < height; ++y)
        {
            const inRowBand = y < band || y >= height - band;
            for (let x = 0; x < width; ++x)
            {
                if (!inRowBand && x >= band && x < width - band)
                    continue;
                const index = (y * width + x) * 4;
                r += data[index];
                g += data[index + 1];
                b += data[index + 2];
                ++count;
            }
        }
        return [Math.round(r / count), Math.round(g / count), Math.round(b / count), 255];
    },

    // The image placed at (x, y) on a width x height one filled with color.
    pad: (image: RgbaImage, width: number, height: number, x: number, y: number,
        color: [number, number, number, number]): RgbaImage =>
    {
        const result = ImageProcessingUtil.createImage(width, height);
        for (let i = 0; i < result.data.length; i += 4)
            result.data.set(color, i);
        for (let row = 0; row < image.height; ++row)
        {
            result.data.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4),
                ((y + row) * width + x) * 4);
        }
        return result;
    },
}

// Heckbert's square-to-quad projective map, taking the picture's (u, v) in 0..1 to the source; with the turn.
function getSampleToSource(corners: [number, number][], width: number, height: number,
    rotation: number): SampleToSource
{
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (den == 0) ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
    const h = (den == 0) ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
    const radians = rotation * Math.PI / 180;
    return {
        a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
        d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0,
        g, h, cos: Math.cos(radians), sin: Math.sin(radians), width, height,
    };
}

// One direction of a box blur that reads and writes only inside the rect.
function boxBlurWithinRect(image: RgbaImage, x0: number, y0: number, x1: number, y1: number, radius: number,
    horizontal: boolean): void
{
    const original = new Uint8ClampedArray(image.data);
    for (let py = y0; py < y1; ++py)
    {
        for (let px = x0; px < x1; ++px)
        {
            const from = horizontal ? Math.max(x0, px - radius) : Math.max(y0, py - radius);
            const to = horizontal ? Math.min(x1 - 1, px + radius) : Math.min(y1 - 1, py + radius);
            for (let channel = 0; channel < 4; ++channel)
            {
                let sum = 0;
                for (let i = from; i <= to; ++i)
                    sum += original[((horizontal ? py : i) * image.width + (horizontal ? i : px)) * 4 + channel];
                image.data[(py * image.width + px) * 4 + channel] = sum / (to - from + 1);
            }
        }
    }
}

function distance(a: [number, number], b: [number, number]): number
{
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default ImageProcessingUtil;
