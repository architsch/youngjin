import { CANVAS_FRAME_ATLAS_CELL_SIZE } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";

// Inner window side length (atlas px) per frame cell "{col},{row}" (see CanvasFrameImageMap). Windows
// are centred, so one length describes each. Measured from the atlas's placeholder windows.
const innerWindowSizeByCellCoords: {[cellCoords: string]: number} =
{
    "0,0": 190, "1,0": 190, "2,0": 179, "3,0": 190,
    "0,1": 190, "1,1": 206, "2,1": 190, "3,1": 190,
    "0,2": 166, "1,2": 190, "2,2": 190, "3,2": 180,
    "0,3": 190, "1,3": 166, "2,3": 190, "3,3": 166,
};

const CanvasFrameInnerWindowMap =
{
    // Image draw scale relative to the cell: the inner window's share plus a small overlap margin.
    getImageDrawScale: (cellCoords: string): number =>
    {
        const innerWindowSize = innerWindowSizeByCellCoords[cellCoords];
        if (innerWindowSize == undefined)
            return 1;
        return innerWindowSize / CANVAS_FRAME_ATLAS_CELL_SIZE;
    },
}

export default CanvasFrameInnerWindowMap;
