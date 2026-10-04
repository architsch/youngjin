// The game image's size: whole atlas cells for an image that keeps its scale (see ImageMetadata.preserveScale),
// or a long side in pixels for one fitted to whatever shows it.
type RecipeOutput =
    | {
        preserveScale: true,
        numCols: number,
        numRows: number,
        // The sample resized to fill its cells (what its margin leaves of them), whatever its own shape, rather than
        // fitted inside them at that shape with room left beside it. Absent: fitted.
        stretch?: boolean,
        // Where the sample sits in the room its cells leave around it, across and down: from 0 (left, top) to 1
        // (right, bottom). Absent: in the middle.
        align?: [number, number],
        // The share of the cells' width and height kept clear around the sample besides, across and down, to show
        // it smaller than its cells. Absent: none.
        margin?: [number, number],
    }
    | {preserveScale: false, longSide: number};

export default RecipeOutput;
