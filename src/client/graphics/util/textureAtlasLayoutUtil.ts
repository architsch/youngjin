import Vec2 from "../../../shared/math/types/vec2";
import TexelRect from "../types/texture/texelRect";
import TextureAtlasRegion from "../types/texture/textureAtlasRegion";
import TextureAtlasFitMode from "../types/texture/textureAtlasFitMode";
import TextureAtlasLayout from "../types/texture/textureAtlasLayout";

// How far content's aspect ratio may miss its area's and still be stretched to fill it, so content made for
// the area's shape leaves no sliver.
const ASPECT_SNAP_TOLERANCE = 0.02;

// Sizes and placement for content drawn in a TextureAtlas region and shown on a quad.
const TextureAtlasLayoutUtil =
{
    // Whole cells covering a world size, less a hair so an exact fit isn't rounded up.
    getNumCells: (worldSize: number, cellWorldSize: number): number =>
    {
        return Math.max(1, Math.ceil(worldSize / cellWorldSize - 1e-6));
    },

    // Content drawn at a fixed density (e.g. lettering), from the region's corner and no larger than it.
    getDensityTexels: (worldSize: Vec2, region: TextureAtlasRegion, cellSize: number,
        pixelsPerWorldUnit: number): TexelRect =>
    {
        const toPixels = (size: number, numCells: number) =>
            Math.max(1, Math.min(numCells * cellSize, Math.round(size * pixelsPerWorldUnit)));
        return {
            x: region.col * cellSize,
            y: region.row * cellSize,
            width: toPixels(worldSize.x, region.numCols),
            height: toPixels(worldSize.y, region.numRows),
        };
    },

    // Content of the given aspect ratio (e.g. an image), from the region's corner and as large as it holds.
    getFittedTexels: (aspect: number, region: TextureAtlasRegion, cellSize: number): TexelRect =>
    {
        const regionWidth = region.numCols * cellSize;
        const regionHeight = region.numRows * cellSize;
        return {
            x: region.col * cellSize,
            y: region.row * cellSize,
            width: Math.max(1, Math.min(regionWidth, Math.round(regionHeight * aspect))),
            height: Math.max(1, Math.min(regionHeight, Math.round(regionWidth / aspect))),
        };
    },

    // The quad showing content on an area, the content turned clockwise by quarterTurns (as the quad is seen),
    // and the texels it samples. contentWorldSize, which "preserve" needs, is the content's own, unturned.
    getLayout: (area: Vec2, content: TexelRect, mode: TextureAtlasFitMode, quarterTurns: number,
        contentWorldSize?: Vec2): TextureAtlasLayout =>
    {
        const turned = quarterTurns % 2 != 0;
        if (mode == "fit")
        {
            const contentAspect = turned ? content.height / content.width : content.width / content.height;
            const areaAspect = area.x / area.y;
            if (Math.abs(contentAspect - areaAspect) <= areaAspect * ASPECT_SNAP_TOLERANCE)
                return {quadSize: {...area}, texelRect: {...content}};
            const quadSize = (contentAspect < areaAspect)
                ? {x: area.y * contentAspect, y: area.y}
                : {x: area.x, y: area.x / contentAspect};
            return {quadSize, texelRect: {...content}};
        }
        if (mode == "preserve" && contentWorldSize != undefined)
        {
            // In the content's own axes, which the turn lays over the area's.
            const visibleX = Math.min(contentWorldSize.x, turned ? area.y : area.x);
            const visibleY = Math.min(contentWorldSize.y, turned ? area.x : area.y);
            const fractionX = visibleX / contentWorldSize.x;
            const fractionY = visibleY / contentWorldSize.y;
            return {
                quadSize: turned ? {x: visibleY, y: visibleX} : {x: visibleX, y: visibleY},
                texelRect: {
                    x: content.x + 0.5 * content.width * (1 - fractionX),
                    y: content.y + 0.5 * content.height * (1 - fractionY),
                    width: content.width * fractionX,
                    height: content.height * fractionY,
                },
            };
        }
        return {quadSize: {...area}, texelRect: {...content}};
    },
}

export default TextureAtlasLayoutUtil;
