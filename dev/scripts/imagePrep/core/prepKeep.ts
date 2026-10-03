// The one part of a re-mapped picture that is kept (see PrepRenderUtil): the result is cut to rect, and what lies
// outside the shape goes see-through. rect is x, y, width and height as fractions of the re-mapped picture; radius
// rounds a rectangle's corners, as a fraction of its shorter side (as RecipeSelection's does).
export default interface PrepKeep
{
    shape: "rect" | "ellipse";
    rect: [number, number, number, number];
    radius?: number;
}
