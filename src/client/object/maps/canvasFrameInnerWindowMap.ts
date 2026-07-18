import { CANVAS_FRAME_ATLAS_CELL_SIZE } from "../../../shared/system/sharedConstants";

// Side length (in atlas pixels) of the square inner "window" of each picture frame in the
// canvas_frames atlas, keyed by the frame's "{col},{row}" cell coordinates (see CanvasFrameImageMap).
// Each frame's window is centered within its cell, so this single length fully describes the
// region where the canvas's image belongs. Measured from the atlas's placeholder-colored windows.
const innerWindowSizeByCellCoords: {[cellCoords: string]: number} =
{
    "0,0": 190, "1,0": 190, "2,0": 179, "3,0": 190,
    "0,1": 190, "1,1": 206, "2,1": 190, "3,1": 190,
    "0,2": 166, "1,2": 190, "2,2": 190, "3,2": 180,
    "0,3": 190, "1,3": 166, "2,3": 190, "3,3": 166,
};

// The image slightly overlaps the frame's inner border (like a real picture tucked behind
// a frame's rabbet), so no sliver of the frame's placeholder-colored window peeks out around
// the image's antialiased edges.
const OVERLAP_MARGIN_IN_PIXELS = 4;

const CanvasFrameInnerWindowMap =
{
    // Returns the scale at which a canvas's image should be drawn relative to its full
    // render-target cell — i.e. the fraction of the frame's full size that its inner window
    // (plus a small overlap margin) occupies.
    getImageDrawScale: (cellCoords: string): number =>
    {
        const innerWindowSize = innerWindowSizeByCellCoords[cellCoords];
        if (innerWindowSize == undefined)
            return 1;
        return (innerWindowSize + OVERLAP_MARGIN_IN_PIXELS) / CANVAS_FRAME_ATLAS_CELL_SIZE;
    },
}

export default CanvasFrameInnerWindowMap;
