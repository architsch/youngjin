import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import NumUtil from "../../math/util/numUtil";
import RoomGenerationSpace from "../types/roomGeneration/roomGenerationSpace";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Turns a bare part of a room into a floor plan: a set of spaces separated by walls, with openings
// through those walls. Nothing here writes a single block — a floor plan is worked out entirely as
// geometry, and the walls in it are never drawn at all, being simply the room's own mass wherever
// no space was put (see RoomGenerationSpaceUtil).
//
// See the "Laying a Room Out" section of @docs/geometry/room_generation.md .

const MIN_DOORWAY_GAP = 4; // in cells, between two doorways on the same wall
const CELLS_PER_DOORWAY = 10; // one more opening is added for roughly every this many cells of wall
const MAX_DOORWAYS_PER_WALL = 3;
const WIDE_DOORWAY_MIN_WALL_LENGTH = 12; // a wall shorter than this gets single-cell doors rather than archways
const ASPECT_TOLERANCE = 1.25; // how lopsided an area may get before the cut axis stops being a coin toss

const RoomGenerationLayoutUtil =
{
    // Recursively cuts a volume into sub-volumes, each at least minSize across, separated by wall
    // lines one cell thick. Only the footprint is cut: every piece comes out standing the full
    // height of the volume it was cut from, since a wall through a room divides it at every height
    // alike. Cutting stops at maxDepth, or as soon as an area is too small to be cut in two.
    splitIntoVolumes: (area: RoomGenerationVolume, minSize: number, maxDepth: number,
        rand: RandomNumberGenerator): {volumes: RoomGenerationVolume[], wallLines: RoomGenerationVolume[]} =>
    {
        const volumes: RoomGenerationVolume[] = [];
        const wallLines: RoomGenerationVolume[] = [];
        splitVolume(area, 0, minSize, maxDepth, rand, volumes, wallLines);
        return {volumes, wallLines};
    },

    // Opens up every wall line between the given spaces, so that what comes back is a floor plan a
    // player can walk the whole of. Because the cuts form a tree of areas, a single opening per
    // wall line is already enough to join all of them.
    //
    // Each opening comes back as a space of its own, finished in the palette of the space it leads
    // into so that its floor and jambs match one of the two rooms it joins instead of being left
    // untextured.
    planDoorways: (spaces: RoomGenerationSpace[], wallLines: RoomGenerationVolume[],
        rand: RandomNumberGenerator): RoomGenerationSpace[] =>
    {
        const doorways: RoomGenerationSpace[] = [];
        for (const wallLine of wallLines)
            planDoorwaysThrough(wallLine, spaces, rand, doorways);
        return doorways;
    },
}

function splitVolume(volume: RoomGenerationVolume, depth: number, minSize: number, maxDepth: number,
    rand: RandomNumberGenerator, volumes: RoomGenerationVolume[], wallLines: RoomGenerationVolume[]): void
{
    // A cut costs one cell for the wall itself, so an area has to be wide enough to hold two
    // minimum-sized halves plus that cell before it can be cut at all.
    const canSplitByCol = volume.numCols >= 2 * minSize + 1;
    const canSplitByRow = volume.numRows >= 2 * minSize + 1;

    if (depth >= maxDepth || (!canSplitByCol && !canSplitByRow))
    {
        volumes.push(volume);
        return;
    }

    // Cutting across the longer axis is what keeps the rooms roughly square instead of letting
    // them degenerate into corridors. Where the two axes are comparable, the seed decides,
    // which is where one generated floor plan starts differing from the next.
    let splitByCol: boolean;
    if (canSplitByCol && canSplitByRow)
    {
        if (volume.numCols > volume.numRows * ASPECT_TOLERANCE)
            splitByCol = true;
        else if (volume.numRows > volume.numCols * ASPECT_TOLERANCE)
            splitByCol = false;
        else
            splitByCol = rand.randomInt(0, 2) == 0;
    }
    else
        splitByCol = canSplitByCol;

    if (splitByCol)
    {
        const lineCol = volume.colStart + rand.randomInt(minSize, volume.numCols - minSize);
        wallLines.push({...volume, colStart: lineCol, numCols: 1});
        splitVolume({...volume, numCols: lineCol - volume.colStart},
            depth + 1, minSize, maxDepth, rand, volumes, wallLines);
        splitVolume({...volume, colStart: lineCol + 1,
            numCols: volume.colStart + volume.numCols - lineCol - 1},
            depth + 1, minSize, maxDepth, rand, volumes, wallLines);
    }
    else
    {
        const lineRow = volume.rowStart + rand.randomInt(minSize, volume.numRows - minSize);
        wallLines.push({...volume, rowStart: lineRow, numRows: 1});
        splitVolume({...volume, numRows: lineRow - volume.rowStart},
            depth + 1, minSize, maxDepth, rand, volumes, wallLines);
        splitVolume({...volume, rowStart: lineRow + 1,
            numRows: volume.rowStart + volume.numRows - lineRow - 1},
            depth + 1, minSize, maxDepth, rand, volumes, wallLines);
    }
}

// Opens up to a few doorways through one wall line, so that the spaces it separates stay reachable
// from one another.
function planDoorwaysThrough(wallLine: RoomGenerationVolume, spaces: RoomGenerationSpace[],
    rand: RandomNumberGenerator, doorways: RoomGenerationSpace[]): void
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
        if (doorwayFits(spaces, wallLine, runsAlongRows, offset, width))
            candidates.push(offset);
    }
    if (candidates.length == 0)
    {
        // This wall offers no clean spot at all (both of the spaces it separates are boxed
        // in by other walls). Break through the middle regardless rather than risk sealing
        // one of them off for good.
        doorways.push(getDoorway(wallLine, runsAlongRows,
            Math.floor(0.5 * (length - width)), width, spaces));
        return;
    }

    const chosen: number[] = [];
    for (let i = 0; i < numDoorways; ++i)
    {
        const spacedOut = candidates.filter(offset =>
            chosen.every(other => Math.abs(other - offset) >= width + MIN_DOORWAY_GAP));
        if (spacedOut.length == 0)
            break;
        chosen.push(rand.pick(spacedOut));
    }
    for (const offset of chosen)
        doorways.push(getDoorway(wallLine, runsAlongRows, offset, width, spaces));
}

function doorwayFits(spaces: RoomGenerationSpace[], wallLine: RoomGenerationVolume,
    runsAlongRows: boolean, offset: number, width: number): boolean
{
    // Step perpendicular to the wall to reach the two spaces it separates.
    const sideRowStep = runsAlongRows ? 0 : 1;
    const sideColStep = runsAlongRows ? 1 : 0;

    for (let i = 0; i < width; ++i)
    {
        const row = wallLine.rowStart + (runsAlongRows ? offset + i : 0);
        const col = wallLine.colStart + (runsAlongRows ? 0 : offset + i);
        if (getSpaceAt(spaces, row, col) != undefined)
            return false; // not a wall at all, so there is nothing here to open up
        if (getSpaceAt(spaces, row - sideRowStep, col - sideColStep) == undefined ||
            getSpaceAt(spaces, row + sideRowStep, col + sideColStep) == undefined)
        {
            return false; // Otherwise the opening would be a dead-end notch where two walls meet.
        }
    }
    return true;
}

function getDoorway(wallLine: RoomGenerationVolume, runsAlongRows: boolean, offset: number,
    width: number, spaces: RoomGenerationSpace[]): RoomGenerationSpace
{
    const rowStart = wallLine.rowStart + (runsAlongRows ? offset : 0);
    const colStart = wallLine.colStart + (runsAlongRows ? 0 : offset);

    const space = getSpaceAt(spaces,
        rowStart - (runsAlongRows ? 0 : 1), colStart - (runsAlongRows ? 1 : 0)) ?? spaces[0];

    // A doorway stands as tall as the wall it is cut through, so that it opens every storey that
    // wall divides at once.
    return {
        volume: {...wallLine, rowStart, colStart,
            numRows: runsAlongRows ? width : 1, numCols: runsAlongRows ? 1 : width},
        palette: space.palette,
    };
}

// The space covering the given cell, or undefined if the cell is not inside any of them — which is
// what makes it a wall: part of the room's mass, either between two spaces or around all of them.
// Anything outside the grid answers the same way, so the room's boundary reads as a wall too.
function getSpaceAt(spaces: RoomGenerationSpace[], row: number,
    col: number): RoomGenerationSpace | undefined
{
    return spaces.find(space => RoomGenerationVolumeUtil.coversCell(space.volume, row, col));
}

export default RoomGenerationLayoutUtil;
