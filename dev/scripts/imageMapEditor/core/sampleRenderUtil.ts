import RgbaImage from "./rgbaImage";
import ImageRecipe from "./imageRecipe";
import RecipeOutput from "./recipeOutput";
import ImageProcessingUtil from "./imageProcessingUtil";
import AlphaMaskUtil from "./alphaMaskUtil";
import ColorAdjustUtil from "./colorAdjustUtil";

// A sample is kept at the resolution its source gives, up to this, so an entry can be made again at another
// size or density without the source.
export const MAX_SAMPLE_SIDE = 2048; // in pixels
// A source is worked at no larger than this.
export const MAX_SOURCE_SIDE = 4096; // in pixels
// The most of a game image's width or height its margin may keep clear (see RecipeOutput.margin).
export const MAX_MARGIN = 0.9;

// Where a sample goes in its game image (see getGameImageLayout).
type GameImageLayout = {width: number, height: number, content: {x: number, y: number, width: number, height: number}};

// How an entry's sample is made from its source (see ImageRecipe), and its game image from the sample. The sample
// is everything but the game image's size: retouched, straightened, cut out, colored and cut to its selection.
const SampleRenderUtil =
{
    // The quad's own size and shape in the source's pixels, no longer than maxSide.
    getSampleSize: (sourceWidth: number, sourceHeight: number, recipe: ImageRecipe,
        maxSide: number = MAX_SAMPLE_SIDE): {width: number, height: number} =>
    {
        const [c0, c1, c2, c3] = toPixels(recipe.corners, sourceWidth, sourceHeight);
        const quadWidth = Math.max(1, 0.5 * (distance(c0, c1) + distance(c3, c2)));
        const quadHeight = Math.max(1, 0.5 * (distance(c0, c3) + distance(c1, c2)));
        const scale = Math.min(1, maxSide / Math.max(quadWidth, quadHeight));
        return {width: Math.max(1, Math.round(quadWidth * scale)), height: Math.max(1, Math.round(quadHeight * scale))};
    },

    // The source may be at any resolution, since the recipe's positions are fractions of it; maxSide lower than
    // the default makes a quick preview.
    renderSample: (source: RgbaImage, recipe: ImageRecipe, maxSide: number = MAX_SAMPLE_SIDE): RgbaImage =>
    {
        return SampleRenderUtil.renderSampleWithKeepMask(source, recipe, maxSide).sample;
    },

    // With what was kept of it (1 per pixel), for a preview that shows what was taken out; undefined when nothing
    // was.
    renderSampleWithKeepMask: (source: RgbaImage, recipe: ImageRecipe,
        maxSide: number = MAX_SAMPLE_SIDE): {sample: RgbaImage, keep: Uint8Array | undefined} =>
    {
        let retouched = source;
        if (recipe.retouches.length > 0)
        {
            retouched = ImageProcessingUtil.copyImage(source);
            for (const [x, y, width, height] of recipe.retouches)
            {
                ImageProcessingUtil.fillFromEdges(retouched,
                    [x * source.width, y * source.height, width * source.width, height * source.height]);
            }
        }
        const {width, height} = SampleRenderUtil.getSampleSize(source.width, source.height, recipe, maxSide);
        const sample = ImageProcessingUtil.warp(retouched, toPixels(recipe.corners, source.width, source.height),
            width, height, recipe.rotation ?? 0);
        // Taken out by the colors as sampled, before they are adjusted.
        const keep = AlphaMaskUtil.getKeepMask(sample, recipe);
        if (keep != undefined)
            AlphaMaskUtil.cutOut(sample, keep);
        if (recipe.adjust != undefined)
            ColorAdjustUtil.adjust(sample, recipe.adjust);
        // After the color changes, so the fill is the color chosen.
        if (recipe.selections != undefined)
            AlphaMaskUtil.fillOutside(sample, recipe.selections);
        return {sample, keep};
    },

    // Where the region the sample was taken from lies on the source, as fractions of it: the quad itself, or the
    // part of the source a turned picture shows.
    getSampledOutline: (sourceWidth: number, sourceHeight: number, recipe: ImageRecipe): [number, number][] =>
    {
        if (!recipe.rotation)
            return recipe.corners;
        const corners = toPixels(recipe.corners, sourceWidth, sourceHeight);
        const {width, height} = SampleRenderUtil.getSampleSize(sourceWidth, sourceHeight, recipe, Infinity);
        return [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
            const [sx, sy] = ImageProcessingUtil.mapSampleToSource(corners, width, height, recipe.rotation!, x, y);
            return [sx / sourceWidth, sy / sourceHeight];
        });
    },

    // An image that keeps its scale is its cells at cellSize each, with the whole sample fitted inside what its
    // margin leaves, and placed in the rest as aligned (see ImageProcessingUtil.getMarginColor for what fills it);
    // any other is the sample's own shape at longSide.
    getGameImageLayout: (output: RecipeOutput, sampleWidth: number, sampleHeight: number,
        cellSize: number): GameImageLayout =>
    {
        if (!output.preserveScale)
        {
            const scale = output.longSide / Math.max(sampleWidth, sampleHeight);
            const width = Math.max(1, Math.round(sampleWidth * scale));
            const height = Math.max(1, Math.round(sampleHeight * scale));
            return {width, height, content: {x: 0, y: 0, width, height}};
        }
        const width = output.numCols * cellSize;
        const height = output.numRows * cellSize;
        const [marginX, marginY] = (output.margin ?? [0, 0]).map(value => clamp(value, 0, MAX_MARGIN));
        const [alignX, alignY] = (output.align ?? [0.5, 0.5]).map(value => clamp(value, 0, 1));
        const scale = Math.min(width * (1 - marginX) / sampleWidth, height * (1 - marginY) / sampleHeight);
        const contentWidth = Math.min(width, Math.max(1, Math.round(sampleWidth * scale)));
        const contentHeight = Math.min(height, Math.max(1, Math.round(sampleHeight * scale)));
        return {width, height, content: {x: Math.floor((width - contentWidth) * alignX),
            y: Math.floor((height - contentHeight) * alignY), width: contentWidth, height: contentHeight}};
    },

    // The game image from a sample already made its content's size (by downscale here, by sharp in Node):
    // sharpened, then set in its margins.
    finishGameImage: (content: RgbaImage, layout: GameImageLayout, marginColor: [number, number, number, number],
        recipe: ImageRecipe): RgbaImage =>
    {
        ColorAdjustUtil.sharpen(content, recipe.adjust?.sharpness ?? 0);
        if (content.width == layout.width && content.height == layout.height)
            return content;
        return ImageProcessingUtil.pad(content, layout.width, layout.height, layout.content.x, layout.content.y,
            marginColor);
    },

    // The game image for a preview, made smaller in the page.
    renderGameImage: (sample: RgbaImage, recipe: ImageRecipe, cellSize: number): RgbaImage =>
    {
        const layout = SampleRenderUtil.getGameImageLayout(recipe.output, sample.width, sample.height, cellSize);
        const content = ImageProcessingUtil.downscale(sample, layout.content.width, layout.content.height);
        return SampleRenderUtil.finishGameImage(content, layout, ImageProcessingUtil.getMarginColor(sample), recipe);
    },
}

function toPixels(points: [number, number][], width: number, height: number): [number, number][]
{
    return points.map(([x, y]) => [x * width, y * height]);
}

function distance(a: [number, number], b: [number, number]): number
{
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default SampleRenderUtil;
