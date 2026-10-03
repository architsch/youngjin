type Point = [number, number];
// The points (x, y) where a*x + b*y = c.
type Line = {a: number, b: number, c: number};
// Its half-axes, and the long one's angle in radians from the x axis toward the y axis.
type Ellipse = {center: Point, major: number, minor: number, angle: number};
// A projective map, row by row.
type Matrix = number[];

// How many points of a fitted ellipse stand in for it.
const ELLIPSE_STEPS = 180;
// A quad map's third coordinate is 1 at the quad's top-left corner and 0 where its plane runs by the viewer's side:
// this near to that, a point is as good as beside the viewer.
const MIN_DEPTH = 1e-3;

// The plane geometry behind a re-mapping (see PrepRenderUtil): a quad's projective map, the shape something round
// gives a squared face, the ellipse through points, and lines and where they meet.
const PlaneGeometryUtil =
{
    // Between the unit square and a quad (top-left, top-right, bottom-right, bottom-left), either way. inFront tells
    // whether a point of the square's plane lies before the viewer: past where the plane runs by the viewer's side,
    // toQuad gives a point the picture never held.
    getQuadMap: (corners: Point[]): {toQuad: (u: number, v: number) => Point,
        toSquare: (x: number, y: number) => Point, inFront: (u: number, v: number) => boolean} =>
    {
        const forward = getSquareToQuad(corners);
        const backward = invert(forward);
        return {
            toQuad: (u, v) => apply(forward, u, v),
            toSquare: (x, y) => apply(backward, x, y),
            inFront: (u, v) => forward[6] * u + forward[7] * v + 1 > MIN_DEPTH,
        };
    },

    // The width over height a squared quad must have for something round, in its plane or parallel to it, to come
    // out round: outline holds points on that thing as it is seen.
    getAspectFromCircle: (corners: Point[], outline: Point[]): number =>
    {
        const ellipse = PlaneGeometryUtil.fitEllipse(outline);
        const {toSquare} = PlaneGeometryUtil.getQuadMap(corners);
        const cos = Math.cos(ellipse.angle), sin = Math.sin(ellipse.angle);
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < ELLIPSE_STEPS; ++i)
        {
            const t = i * 2 * Math.PI / ELLIPSE_STEPS;
            const along = ellipse.major * Math.cos(t), across = ellipse.minor * Math.sin(t);
            const [u, v] = toSquare(ellipse.center[0] + along * cos - across * sin,
                ellipse.center[1] + along * sin + across * cos);
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
        }
        // Round in the plane, it spans the same length across and down, and so the shares of the square it spans
        // are as the square's height is to its width.
        return (maxV - minV) / (maxU - minU);
    },

    // The quad's own width over height, by its sides as they are seen: right only for a face seen nearly head-on.
    getAspectFromSides: (corners: Point[]): number =>
    {
        const [c0, c1, c2, c3] = corners;
        return (distance(c0, c1) + distance(c3, c2)) / (distance(c0, c3) + distance(c1, c2));
    },

    // The ellipse closest to five or more points, by least squares.
    fitEllipse: (points: Point[]): Ellipse =>
    {
        if (points.length < 5)
            throw new Error("an ellipse takes five points or more");
        // About their middle and at unit size, so the fit is well conditioned.
        const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
        const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
        const scale = points.reduce((sum, point) => sum + Math.hypot(point[0] - cx, point[1] - cy), 0) / points.length || 1;

        // A*x^2 + B*x*y + C*y^2 + D*x + E*y = 1: its middle lies within the points, so never on the curve.
        const normal = Array.from({length: 5}, () => new Array<number>(5).fill(0));
        const target = new Array<number>(5).fill(0);
        for (const point of points)
        {
            const x = (point[0] - cx) / scale, y = (point[1] - cy) / scale;
            const row = [x * x, x * y, y * y, x, y];
            for (let i = 0; i < 5; ++i)
            {
                target[i] += row[i];
                for (let j = 0; j < 5; ++j)
                    normal[i][j] += row[i] * row[j];
            }
        }
        const [A, B, C, D, E] = solve(normal, target);

        const det = 4 * A * C - B * B;
        const x0 = (B * E - 2 * C * D) / det, y0 = (B * D - 2 * A * E) / det;
        // About its own middle the curve is A*x^2 + B*x*y + C*y^2 = level.
        const level = 1 - 0.5 * (D * x0 + E * y0);
        const mean = 0.5 * (A + C), spread = Math.hypot(0.5 * (A - C), 0.5 * B);
        if (!(det > 0) || !(level / (mean + spread) > 0) || !(level / (mean - spread) > 0))
            throw new Error("the points don't lie on an ellipse");
        return {
            center: [cx + x0 * scale, cy + y0 * scale],
            major: Math.sqrt(level / (mean - spread)) * scale,
            minor: Math.sqrt(level / (mean + spread)) * scale,
            // The quadratic form's steeper direction is the short axis.
            angle: 0.5 * Math.atan2(B, A - C) + Math.PI / 2,
        };
    },

    // The line closest to the points: steep for one running more down than across, which is fitted the other way
    // round so its slope stays small.
    fitLine: (points: Point[], steep: boolean): Line =>
    {
        const n = points.length;
        let sumT = 0, sumS = 0, sumTT = 0, sumTS = 0;
        for (const [x, y] of points)
        {
            const t = steep ? y : x, s = steep ? x : y;
            sumT += t;
            sumS += s;
            sumTT += t * t;
            sumTS += t * s;
        }
        const spread = n * sumTT - sumT * sumT;
        if (n < 2 || spread == 0)
            throw new Error("a line takes two points or more, apart");
        const slope = (n * sumTS - sumT * sumS) / spread;
        const offset = (sumS - slope * sumT) / n;
        return steep ? {a: 1, b: -slope, c: offset} : {a: -slope, b: 1, c: offset};
    },

    intersect: (p: Line, q: Line): Point =>
    {
        const det = p.a * q.b - q.a * p.b;
        if (Math.abs(det) < 1e-12)
            throw new Error("two of the lines run side by side and never meet");
        return [(p.c * q.b - q.c * p.b) / det, (p.a * q.c - q.a * p.c) / det];
    },
}

// Heckbert's square-to-quad projective map, as the image map editor's warp samples by (see ImageProcessingUtil).
function getSquareToQuad(corners: Point[]): Matrix
{
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    if (den == 0)
        throw new Error("the corners don't span a quad");
    const g = (dx3 * dy2 - dx2 * dy3) / den;
    const h = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function apply(m: Matrix, x: number, y: number): Point
{
    const w = m[6] * x + m[7] * y + m[8];
    return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

// By its adjugate: a projective map is the same at any scale, so the determinant is left out.
function invert(m: Matrix): Matrix
{
    return [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
    ];
}

// Gaussian elimination with partial pivoting.
function solve(matrix: number[][], target: number[]): number[]
{
    const n = target.length;
    const rows = matrix.map((row, i) => [...row, target[i]]);
    for (let column = 0; column < n; ++column)
    {
        let pivot = column;
        for (let row = column + 1; row < n; ++row)
        {
            if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
                pivot = row;
        }
        if (Math.abs(rows[pivot][column]) < 1e-12)
            throw new Error("the points don't lie on an ellipse");
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        for (let row = column + 1; row < n; ++row)
        {
            const factor = rows[row][column] / rows[column][column];
            for (let k = column; k <= n; ++k)
                rows[row][k] -= factor * rows[column][k];
        }
    }
    const result = new Array<number>(n).fill(0);
    for (let row = n - 1; row >= 0; --row)
    {
        let sum = rows[row][n];
        for (let k = row + 1; k < n; ++k)
            sum -= rows[row][k] * result[k];
        result[row] = sum / rows[row][row];
    }
    return result;
}

function distance(a: Point, b: Point): number
{
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export default PlaneGeometryUtil;
