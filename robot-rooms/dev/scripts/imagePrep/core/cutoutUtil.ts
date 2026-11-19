import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import PlaneGeometryUtil from "./planeGeometryUtil";

// A pixel at least this opaque is the object's: its color is its own, and it counts toward the outline and the
// pieces.
const SOLID_ALPHA = 128;
// A piece smaller than this share of the largest one is a stray, as is whatever lies further than the margin (in
// pixels) from every piece kept.
const STRAY_SHARE = 0.05;
const STRAY_MARGIN = 2;

// What a picture already cut out of its background needs before it is resampled (see PrepRenderUtil, Upscaler), and
// what its outline tells of its shape.
const CutoutUtil =
{
    // Gives the see-through pixels within reach (in pixels) of the object its own nearest colors, leaving their alpha.
    // A cut-out keeps whatever color its background had under its transparency, and resampling blends that into its
    // edge as a pale or dark fringe. A pixel at least solidAlpha opaque is taken to have the object's color already.
    carryColors: (image: RgbaImage, reach: number, solidAlpha: number = SOLID_ALPHA): void =>
    {
        const {width, height, data} = image;
        const count = width * height;
        // 1 where a pixel's color is the object's: a solid pixel's own, or one carried to it.
        const known = new Uint8Array(count);
        for (let p = 0; p < count; ++p)
            known[p] = (data[p * 4 + 3] >= solidAlpha) ? 1 : 0;

        const queued = new Uint8Array(count);
        let frontier: number[] = [];
        const queueAround = (p: number) => {
            const x = p % width, y = (p - x) / width;
            for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ++ny)
            {
                for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); ++nx)
                {
                    const q = ny * width + nx;
                    if (!known[q] && !queued[q])
                    {
                        queued[q] = 1;
                        frontier.push(q);
                    }
                }
            }
        };
        for (let p = 0; p < count; ++p)
        {
            if (known[p])
                queueAround(p);
        }

        for (let step = 0; step < reach && frontier.length > 0; ++step)
        {
            // All from the pixels known before this step, so a step is one pixel deep in whatever order it runs.
            const colors = new Float32Array(frontier.length * 3);
            frontier.forEach((p, i) => {
                const x = p % width, y = (p - x) / width;
                let r = 0, g = 0, b = 0, n = 0;
                for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ++ny)
                {
                    for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); ++nx)
                    {
                        const q = ny * width + nx;
                        if (!known[q])
                            continue;
                        r += data[q * 4];
                        g += data[q * 4 + 1];
                        b += data[q * 4 + 2];
                        ++n;
                    }
                }
                colors.set([r / n, g / n, b / n], i * 3);
            });
            const colored = frontier;
            frontier = [];
            colored.forEach((p, i) => {
                data[p * 4] = colors[i * 3];
                data[p * 4 + 1] = colors[i * 3 + 1];
                data[p * 4 + 2] = colors[i * 3 + 2];
                known[p] = 1;
            });
            colored.forEach(queueAround);
        }
    },

    // Makes see-through whatever a rough cut-out left around the object: every piece far smaller than the largest
    // (four burners are four pieces, and all stay), and any haze away from the pieces kept. Returns how many pixels
    // went.
    dropStrays: (image: RgbaImage): number =>
    {
        const {width, height, data} = image;
        const count = width * height;
        const pieceOf = new Int32Array(count).fill(-1);
        const sizes: number[] = [];
        const stack = new Int32Array(count);
        for (let start = 0; start < count; ++start)
        {
            if (pieceOf[start] >= 0 || data[start * 4 + 3] < SOLID_ALPHA)
                continue;
            const piece = sizes.length;
            let size = 0, top = 0;
            const visit = (to: number) => {
                if (pieceOf[to] < 0 && data[to * 4 + 3] >= SOLID_ALPHA)
                {
                    pieceOf[to] = piece;
                    stack[top++] = to;
                }
            };
            visit(start);
            while (top > 0)
            {
                const p = stack[--top];
                ++size;
                const x = p % width;
                if (x > 0)
                    visit(p - 1);
                if (x < width - 1)
                    visit(p + 1);
                if (p >= width)
                    visit(p - width);
                if (p < count - width)
                    visit(p + width);
            }
            sizes.push(size);
        }
        if (sizes.length == 0)
            return 0;

        const least = STRAY_SHARE * sizes.reduce((largest, size) => Math.max(largest, size), 0);
        const near = new Uint8Array(count);
        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                const piece = pieceOf[y * width + x];
                if (piece < 0 || sizes[piece] < least)
                    continue;
                const from = Math.max(0, x - STRAY_MARGIN), to = Math.min(width - 1, x + STRAY_MARGIN);
                for (let ny = Math.max(0, y - STRAY_MARGIN); ny <= Math.min(height - 1, y + STRAY_MARGIN); ++ny)
                    near.fill(1, ny * width + from, ny * width + to + 1);
            }
        }
        let dropped = 0;
        for (let p = 0; p < count; ++p)
        {
            if (!near[p] && data[p * 4 + 3] > 0)
            {
                data[p * 4 + 3] = 0;
                ++dropped;
            }
        }
        return dropped;
    },

    // The line along one side of the object's outline, fitted to where the outline lies on each row or column of the
    // stretches given (from and to along that side, as fractions).
    fitSide: (image: RgbaImage, side: "left" | "right" | "top" | "bottom",
        stretches: [number, number][]): ReturnType<typeof PlaneGeometryUtil.fitLine> =>
    {
        const {width, height, data} = image;
        const steep = side == "left" || side == "right";
        const fromFarEnd = side == "right" || side == "bottom";
        const along = steep ? height : width, across = steep ? width : height;
        const solid = (i: number, j: number) => data[((steep ? i : j) * width + (steep ? j : i)) * 4 + 3] >= SOLID_ALPHA;
        const points: [number, number][] = [];
        for (const [from, to] of stretches)
        {
            for (let i = Math.max(0, Math.round(from * along)); i < Math.min(along, Math.round(to * along)); ++i)
            {
                for (let step = 0; step < across; ++step)
                {
                    const j = fromFarEnd ? across - 1 - step : step;
                    if (!solid(i, j))
                        continue;
                    // The outline is the solid pixel's outer edge.
                    const edge = fromFarEnd ? j + 1 : j;
                    points.push(steep ? [edge, i + 0.5] : [i + 0.5, edge]);
                    break;
                }
            }
        }
        return PlaneGeometryUtil.fitLine(points, steep);
    },

    // The smallest rectangle holding everything that isn't fully see-through, in pixels; undefined if nothing is.
    getBounds: (image: RgbaImage): {x: number, y: number, width: number, height: number} | undefined =>
    {
        const {width, height, data} = image;
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                if (data[(y * width + x) * 4 + 3] == 0)
                    continue;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
        return (maxX < 0) ? undefined : {x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1};
    },
}

export default CutoutUtil;
