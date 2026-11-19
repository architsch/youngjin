import SampleOrder from "./sampleOrder";
import SourceEntry from "./sourceEntry";
import ImageRecipe from "./imageRecipe";
import RecipeOutput from "./recipeOutput";

// Slack for a position read off a survey's grid a hair past the source's edge.
const EDGE_SLACK = 0.002;

const SampleOrderUtil =
{
    // Throws, naming the order, if it doesn't say what to sample or how big to make it.
    toRecipe: (order: SampleOrder, source: SourceEntry): ImageRecipe =>
    {
        const fail = (reason: string) => { throw new Error(`"${order.title}": ${reason}`); };
        if ((order.cells == undefined) == (order.longSide == undefined))
            fail("give cells or longSide, one of the two");
        if (order.cells == undefined && (order.align != undefined || order.margin != undefined || order.stretch))
            fail("align, margin and stretch place a sample in its cells, so they need cells");
        const output: RecipeOutput = (order.cells != undefined)
            ? {preserveScale: true, numCols: order.cells[0], numRows: order.cells[1],
                ...(order.stretch ? {stretch: true} : {}),
                ...(order.align ? {align: order.align} : {}), ...(order.margin ? {margin: order.margin} : {})}
            : {preserveScale: false, longSide: order.longSide!};

        let corners = order.corners;
        if (corners == undefined)
        {
            if (order.rect == undefined)
                fail("give rect or corners");
            const [x, y, w] = order.rect!;
            if (order.rect!.length == 3 && order.cells == undefined)
                fail("a rect without a height needs cells, whose shape it follows");
            const h = order.rect![3] ?? w * (source.width / source.height) * (order.cells![1] / order.cells![0]);
            corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        }
        if (corners.length != 4 || corners.some(([u, v]) => Math.min(u, v) < -EDGE_SLACK || Math.max(u, v) > 1 + EDGE_SLACK))
            fail(`its corners ${JSON.stringify(corners)} run past the source's edges`);
        corners = corners.map(([u, v]) => [clamp01(u), clamp01(v)]);

        // Retouches are given in the sample and painted in the source, over the quad's bounds.
        const us = corners.map(([u]) => u), vs = corners.map(([, v]) => v);
        const left = Math.min(...us), top = Math.min(...vs);
        const width = Math.max(...us) - left, height = Math.max(...vs) - top;
        return {
            sourceSha1: source.sha1,
            sourceFileName: source.fileName,
            corners,
            ...(order.rotation ? {rotation: order.rotation} : {}),
            retouches: (order.retouches ?? []).map(([u, v, du, dv]) =>
                [left + u * width, top + v * height, du * width, dv * height]),
            ...(order.background ? {background: order.background} : {}),
            ...(order.selections?.length ? {selections: order.selections} : {}),
            ...(order.alphaEdits?.length ? {alphaEdits: order.alphaEdits} : {}),
            ...(order.adjust ? {adjust: {brightness: 0, contrast: 0, saturation: 0, hue: 0, warmth: 0, sharpness: 0,
                ...order.adjust}} : {}),
            output,
        };
    },
}

function clamp01(value: number): number
{
    return Math.min(1, Math.max(0, value));
}

export default SampleOrderUtil;
