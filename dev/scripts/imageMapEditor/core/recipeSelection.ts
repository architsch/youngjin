// One of the selections the sample is cut to (see AlphaMaskUtil): what lies outside it is taken out, adding to what
// the background fill, hand edits and the other selections take, or filled with a color. rect is x, y, width and
// height as fractions of the sample, before the turn; radius rounds a rectangle's corners, as a fraction of its
// shorter side.
export default interface RecipeSelection
{
    shape: "rect" | "ellipse";
    rect: [number, number, number, number];
    radius: number;
    // Degrees clockwise about its middle, measured in the sample's pixels (so a square stays square). Absent: 0.
    angle?: number;
    // "#rrggbb" to fill what lies outside with; undefined to take it out.
    fill?: string;
}
