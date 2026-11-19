import RecipeBackground from "./recipeBackground";
import RecipeSelection from "./recipeSelection";
import RecipeAlphaEdit from "./recipeAlphaEdit";
import RecipeAdjust from "./recipeAdjust";

// One sample to be made an entry by --save-samples (see BatchCommands), written down from a survey of its source
// (see --survey). Positions in the source are fractions of its width and height, as the survey's grid is labeled;
// positions in the sample (retouches, and those of background, selections and alphaEdits) are fractions of the
// sample.
export default interface SampleOrder
{
    // The source in the library: its page's address, its Unsplash id, its sha1, or, for one added from a file, its
    // file name.
    source: string;
    subfolder: string;
    title: string;
    // What a search finds it by, comma-separated (see ImageEntry): needed with cells, left out for a painting.
    keywords?: string;
    // Cells across and down, for an image that keeps its scale; or the long side in pixels of one fitted to its
    // canvas. One of the two.
    cells?: [number, number];
    longSide?: number;
    // With cells: where the sample sits in them, the margin kept clear around it, and whether it is stretched to fill
    // them rather than fitted inside (see RecipeOutput).
    align?: [number, number];
    margin?: [number, number];
    stretch?: boolean;
    // The part sampled: x, y and width, with the height following the cells' shape (so the image has no margins),
    // or x, y, width and height. Corners instead, for a face seen at an angle (top-left, top-right, bottom-right,
    // bottom-left).
    rect?: [number, number, number] | [number, number, number, number];
    corners?: [number, number][];
    // Degrees clockwise, to straighten a tilted photo.
    rotation?: number;
    // Painted over from their edges (logos, brand plates): x, y, width and height.
    retouches?: [number, number, number, number][];
    background?: RecipeBackground;
    selections?: RecipeSelection[];
    alphaEdits?: RecipeAlphaEdit[];
    adjust?: Partial<RecipeAdjust>;
    // Written back by --save-samples once the entry is made, so running it again remakes that entry.
    path?: string;
}
