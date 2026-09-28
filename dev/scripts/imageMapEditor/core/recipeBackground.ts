// What of a sample is background, to be made transparent (see AlphaMaskUtil.findBackground): what a fill reaches from
// its starts through similar colors, each start filling against its own color. Distances are CIELAB (delta E), so a
// threshold works alike on dark and light colors.
export default interface RecipeBackground
{
    // Start the fill from every pixel of the border too.
    fromBorder: boolean;
    // Clicked points, as fractions of the sample's width and height.
    seeds: [number, number][];
    // How far a pixel may be from the color of the start the fill reached it from.
    tolerance: number;
    // How far a pixel may be from the one the fill reached it from, so a fill follows shading but stops at an
    // edge. Undefined: no such limit.
    step?: number;
    // Keep only the largest region the fill leaves (the object), dropping specks it couldn't reach.
    keepLargest: boolean;
}
