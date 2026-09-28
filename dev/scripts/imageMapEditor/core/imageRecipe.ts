import RecipeBackground from "./recipeBackground";
import RecipeSelection from "./recipeSelection";
import RecipeOutput from "./recipeOutput";
import RecipeAlphaEdit from "./recipeAlphaEdit";
import RecipeAdjust from "./recipeAdjust";

// How an entry's sample is made from its source photo (see SampleRenderUtil). Positions are fractions of the
// source's width and height, so they hold at any resolution it is worked at.
export default interface ImageRecipe
{
    // The source file, by content (see SourceLibrary).
    sourceSha1: string;
    sourceFileName: string;
    // The quad sampled: top-left, top-right, bottom-right, bottom-left (a rectangle, or a face seen at an angle).
    corners: [number, number][];
    // Degrees the picture is turned clockwise within the quad, to straighten a tilted photo.
    rotation?: number;
    // Rects painted over from their edges before sampling (e.g. a logo): x, y, width, height.
    retouches: [number, number, number, number][];
    background?: RecipeBackground;
    // Absent rather than empty.
    selections?: RecipeSelection[];
    alphaEdits?: RecipeAlphaEdit[];
    adjust?: RecipeAdjust;
    output: RecipeOutput;
}
