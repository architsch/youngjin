import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import NumUtil from "../../math/util/numUtil";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import RoomGenerationRect from "../types/roomGeneration/roomGenerationRect";
import RoomGenerationRegion from "../types/roomGeneration/roomGenerationRegion";
import RoomGenerationVoxelGrid from "../types/roomGeneration/roomGenerationVoxelGrid";
import { RoomGenerationVoxelType } from "../types/roomGeneration/roomGenerationVoxelType";

// Turns a bare area of a room into a floor plan: a set of rooms separated by walls, with
// openings through those walls. It works on the room generation grid, where every cell starts
// out solid and a region is carved out of it, so the walls are simply the cells no region
// claimed — the plan never has to draw them.
//
// See the "Room Generation Grid" section of @docs/geometry/room_generation.md .

const MIN_DOORWAY_GAP = 4; // in cells, between two doorways on the same wall
const CELLS_PER_DOORWAY = 10; // one more opening is added for roughly every this many cells of wall
const MAX_DOORWAYS_PER_WALL = 3;
const WIDE_DOORWAY_MIN_WALL_LENGTH = 12; // a wall shorter than this gets single-cell doors rather than archways
const ASPECT_TOLERANCE = 1.25; // how lopsided an area may get before the cut axis stops being a coin toss

const RoomGenerationLayoutUtil =
{
    // Recursively cuts an area into rectangular sub-areas, each at least minSize across,
    // separated by wall lines one cell thick. Purely geometric — nothing is written anywhere,
    // so the caller decides what the resulting rects and wall lines become.
    // Cutting stops at maxDepth, or as soon as an area is too small to be cut in two.
    splitIntoRects: (area: RoomGenerationRect, minSize: number, maxDepth: number,
        rand: RandomNumberGenerator): {rects: RoomGenerationRect[], wallLines: RoomGenerationRect[]} =>
    {
        const rects: RoomGenerationRect[] = [];
        const wallLines: RoomGenerationRect[] = [];
        splitRect(area, 0, minSize, maxDepth, rand, rects, wallLines);
        return {rects, wallLines};
    },

    // Opens up to a few doorways through a wall line, so that the areas it separates stay
    // reachable from one another. Applied to every wall line of a split, this is what keeps the
    // whole floor plan connected: the splits form a tree of areas, so one opening per line is
    // already enough to join all of them.
    // Each opening is finished in the palette of the region it leads into, so that its floor
    // and jambs match one of the two rooms it joins instead of being left untextured.
    carveDoorways: (grid: RoomGenerationVoxelGrid, wallLine: RoomGenerationRect,
        regions: RoomGenerationRegion[], rand: RandomNumberGenerator): void =>
    {
        const runsAlongRows = wallLine.numCols == 1; // i.e. the wall is a single column of cells
        const length = runsAlongRows ? wallLine.numRows : wallLine.numCols;
        const width = (length >= WIDE_DOORWAY_MIN_WALL_LENGTH) ? 2 : 1;
        const numDoorways = NumUtil.clampInRange(
            Math.round(length / CELLS_PER_DOORWAY), 1, MAX_DOORWAYS_PER_WALL);

        // An opening needs open floor on both sides and a jamb left at either end of the wall,
        // which rules out the stretches where this wall runs into another one.
        const candidates: number[] = [];
        for (let offset = 1; offset + width <= length - 1; ++offset)
        {
            if (doorwayFits(grid, wallLine, runsAlongRows, offset, width))
                candidates.push(offset);
        }
        if (candidates.length == 0)
        {
            // This wall offers no clean spot at all (both of the areas it separates are boxed
            // in by other walls). Break through the middle regardless rather than risk sealing
            // one of them off for good.
            carveDoorway(grid, wallLine, runsAlongRows,
                Math.floor(0.5 * (length - width)), width, regions);
            return;
        }

        const chosen: number[] = [];
        for (let i = 0; i < numDoorways; ++i)
        {
            const spacedOut = candidates.filter(offset =>
                chosen.every(other => Math.abs(other - offset) >= width + MIN_DOORWAY_GAP));
            if (spacedOut.length == 0)
                break;
            chosen.push(spacedOut[rand.randomInt(0, spacedOut.length)]);
        }
        for (const offset of chosen)
            carveDoorway(grid, wallLine, runsAlongRows, offset, width, regions);
    },

    // The region covering the given cell, or undefined if the cell is not inside any of them
    // (i.e. it is part of a wall between regions, or of the room's boundary).
    getRegionAt: (regions: RoomGenerationRegion[], row: number, col: number): RoomGenerationRegion | undefined =>
    {
        return regions.find(region =>
            row >= region.rect.rowStart && row < region.rect.rowStart + region.rect.numRows &&
            col >= region.rect.colStart && col < region.rect.colStart + region.rect.numCols);
    },
}

function splitRect(rect: RoomGenerationRect, depth: number, minSize: number, maxDepth: number,
    rand: RandomNumberGenerator, rects: RoomGenerationRect[], wallLines: RoomGenerationRect[]): void
{
    // A cut costs one cell for the wall itself, so an area has to be wide enough to hold two
    // minimum-sized halves plus that cell before it can be cut at all.
    const canSplitByCol = rect.numCols >= 2 * minSize + 1;
    const canSplitByRow = rect.numRows >= 2 * minSize + 1;

    if (depth >= maxDepth || (!canSplitByCol && !canSplitByRow))
    {
        rects.push(rect);
        return;
    }

    // Cutting across the longer axis is what keeps the rooms roughly square instead of letting
    // them degenerate into corridors. Where the two axes are comparable, the seed decides,
    // which is where one generated floor plan starts differing from the next.
    let splitByCol: boolean;
    if (canSplitByCol && canSplitByRow)
    {
        if (rect.numCols > rect.numRows * ASPECT_TOLERANCE)
            splitByCol = true;
        else if (rect.numRows > rect.numCols * ASPECT_TOLERANCE)
            splitByCol = false;
        else
            splitByCol = rand.randomInt(0, 2) == 0;
    }
    else
        splitByCol = canSplitByCol;

    if (splitByCol)
    {
        const lineCol = rect.colStart + rand.randomInt(minSize, rect.numCols - minSize);
        wallLines.push({rowStart: rect.rowStart, colStart: lineCol, numRows: rect.numRows, numCols: 1});
        splitRect({rowStart: rect.rowStart, colStart: rect.colStart,
            numRows: rect.numRows, numCols: lineCol - rect.colStart},
            depth + 1, minSize, maxDepth, rand, rects, wallLines);
        splitRect({rowStart: rect.rowStart, colStart: lineCol + 1,
            numRows: rect.numRows, numCols: rect.colStart + rect.numCols - lineCol - 1},
            depth + 1, minSize, maxDepth, rand, rects, wallLines);
    }
    else
    {
        const lineRow = rect.rowStart + rand.randomInt(minSize, rect.numRows - minSize);
        wallLines.push({rowStart: lineRow, colStart: rect.colStart, numRows: 1, numCols: rect.numCols});
        splitRect({rowStart: rect.rowStart, colStart: rect.colStart,
            numRows: lineRow - rect.rowStart, numCols: rect.numCols},
            depth + 1, minSize, maxDepth, rand, rects, wallLines);
        splitRect({rowStart: lineRow + 1, colStart: rect.colStart,
            numRows: rect.rowStart + rect.numRows - lineRow - 1, numCols: rect.numCols},
            depth + 1, minSize, maxDepth, rand, rects, wallLines);
    }
}

function doorwayFits(grid: RoomGenerationVoxelGrid, wallLine: RoomGenerationRect,
    runsAlongRows: boolean, offset: number, width: number): boolean
{
    // Step perpendicular to the wall to reach the two areas it separates.
    const sideRowStep = runsAlongRows ? 0 : 1;
    const sideColStep = runsAlongRows ? 1 : 0;

    for (let i = 0; i < width; ++i)
    {
        const row = wallLine.rowStart + (runsAlongRows ? offset + i : 0);
        const col = wallLine.colStart + (runsAlongRows ? 0 : offset + i);
        if (getVoxelType(grid, row, col) != RoomGenerationVoxelType.Wall)
            return false;
        if (getVoxelType(grid, row - sideRowStep, col - sideColStep) != RoomGenerationVoxelType.Floor ||
            getVoxelType(grid, row + sideRowStep, col + sideColStep) != RoomGenerationVoxelType.Floor)
        {
            return false; // Otherwise the opening would be a dead-end notch where two walls meet.
        }
    }
    return true;
}

function carveDoorway(grid: RoomGenerationVoxelGrid, wallLine: RoomGenerationRect,
    runsAlongRows: boolean, offset: number, width: number, regions: RoomGenerationRegion[]): void
{
    const rowStart = wallLine.rowStart + (runsAlongRows ? offset : 0);
    const colStart = wallLine.colStart + (runsAlongRows ? 0 : offset);

    const region = RoomGenerationLayoutUtil.getRegionAt(regions,
        rowStart - (runsAlongRows ? 0 : 1), colStart - (runsAlongRows ? 1 : 0)) ?? regions[0];

    grid.createRegion(rowStart, colStart,
        runsAlongRows ? width : 1, runsAlongRows ? 1 : width,
        region.palette.floorTextureIndex, region.palette.ceilingTextureIndex,
        region.palette.wallTextureIndex);
}

// Anything outside the grid counts as wall, so that the room's boundary reads the same way as
// an interior wall to everything above.
function getVoxelType(grid: RoomGenerationVoxelGrid, row: number, col: number): RoomGenerationVoxelType
{
    if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS)
        return RoomGenerationVoxelType.Wall;
    return grid.voxels[row * NUM_VOXEL_COLS + col].type;
}

export default RoomGenerationLayoutUtil;
