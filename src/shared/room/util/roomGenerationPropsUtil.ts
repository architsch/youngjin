import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import RoomGenerationPalette from "../types/roomGeneration/roomGenerationPalette";
import RoomGenerationSpace from "../types/roomGeneration/roomGenerationSpace";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Stands decorative block work inside the spaces of a room that is already built. Everything here
// works off the finished voxel grid, so it is equally usable on a room being generated from scratch
// and on one being redecorated.
//
// A prop is furniture in the space a player walks around it in, so it rises from that space's own
// floor and stops below its own ceiling rather than running through the room. Which space it
// belongs to is what decides where it may stand at all: nothing a generator builds may hang in
// mid-air, and a space's floor is a slab the room may have been left without.

const PROP_MARGIN = 2; // cells left clear between a space's edge and anything standing inside it
const PILLAR_SPACING = 4;
const HALF_HEIGHT_PILLAR_HEIGHT = 4; // in layers, counted up from the floor the pillar stands on
const PLINTH_HEIGHT = 2; // waist height: reads as a display stand, and never blocks the view across a room
const CENTREPIECE_MIN_SIZE = 4; // below this the centrepiece shrinks to a single cell

const RoomGenerationPropsUtil =
{
    // Stands one arrangement of decorative blocks in one space of a room, chosen by the seed. Some
    // spaces are deliberately left bare, so that a generated room has open space in it as well as
    // furnished space.
    addProps: (voxelGrid: VoxelGrid, space: RoomGenerationSpace,
        keepClearVolumes: RoomGenerationVolume[], rand: RandomNumberGenerator): void =>
    {
        const inner = RoomGenerationVolumeUtil.inset(space.volume, PROP_MARGIN);
        if (RoomGenerationVolumeUtil.isEmpty(inner))
            return; // The space is too small to hold anything without crowding its doorways.

        const arrangement = planArrangement(inner, space.palette, rand);
        if (arrangement != undefined)
            raise(voxelGrid, arrangement, keepClearVolumes);
    },
}

// One arrangement of block work, as a plan rather than as blocks: the volume its stacks stand in,
// which of that volume's cells they stand on, and what their faces are finished with. Keeping the
// arrangements purely geometric is what lets every one of them be placed by the same rules below.
interface Arrangement
{
    volume: RoomGenerationVolume;
    cells: {row: number, col: number}[];
    textureIndices: number[];
}

function planArrangement(inner: RoomGenerationVolume, palette: RoomGenerationPalette,
    rand: RandomNumberGenerator): Arrangement | undefined
{
    switch (rand.randomInt(0, 4))
    {
        case 0: return planColonnade(inner, palette, rand);
        case 1: return planCentrepiece(inner, palette);
        case 2: return planCornerBlocks(inner, palette);
        default: return undefined; // left bare
    }
}

// Builds one arrangement into the room, leaving out every stack that must not be there: one
// standing where the room has promised to keep the floor clear, and one with nothing under it to
// stand on.
function raise(voxelGrid: VoxelGrid, arrangement: Arrangement,
    keepClearVolumes: RoomGenerationVolume[]): void
{
    const {volume} = arrangement;
    const collisionLayerMax = RoomGenerationVolumeUtil.getCollisionLayerMax(volume);

    for (const {row, col} of arrangement.cells)
    {
        if (RoomGenerationVolumeUtil.coveredByAny(keepClearVolumes, row, col))
            continue;
        if (!hasFloorUnderIt(voxelGrid, volume, row, col))
            continue;
        RoomGenerationHelperUtil.addWall(voxelGrid.voxels, row, col, arrangement.textureIndices,
            volume.collisionLayerStart, collisionLayerMax);
    }
}

// Whether this cell has a floor under it for something to stand on. A space on the ground stands on
// the room's own floor, which is everywhere; one above it stands on a slab the room may have been
// left without — over a stairwell, or across a space the storey above looks down into — and a prop
// placed there would be left hanging over the drop.
function hasFloorUnderIt(voxelGrid: VoxelGrid, volume: RoomGenerationVolume,
    row: number, col: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
    return voxel != undefined && VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel,
        RoomGenerationVolumeUtil.getFloorCollisionLayer(volume));
}

// The volume an arrangement of the given height fills, standing on the floor of the space it
// furnishes and never rising into that space's ceiling.
function getArrangementVolume(inner: RoomGenerationVolume,
    heightInLayers: number): RoomGenerationVolume
{
    return {...inner, numCollisionLayers: Math.min(inner.numCollisionLayers, heightInLayers)};
}

// Two rows of columns flanking the space's central aisle. They run along whichever axis is
// longer, so the aisle leads somewhere instead of dead-ending straight away.
function planColonnade(inner: RoomGenerationVolume, palette: RoomGenerationPalette,
    rand: RandomNumberGenerator): Arrangement | undefined
{
    const runsAlongCols = inner.numCols >= inner.numRows;
    const spanLength = runsAlongCols ? inner.numCols : inner.numRows;
    if (spanLength < PILLAR_SPACING)
        return undefined;

    const heightInLayers = (rand.randomInt(0, 2) == 0)
        ? inner.numCollisionLayers : HALF_HEIGHT_PILLAR_HEIGHT;

    // Centre the run of columns within the span, so that the colonnade comes out symmetric.
    const numPillars = 1 + Math.floor((spanLength - 1) / PILLAR_SPACING);
    const startOffset = Math.floor(0.5 * (spanLength - 1 - (numPillars - 1) * PILLAR_SPACING));

    const cells: {row: number, col: number}[] = [];
    for (let i = 0; i < numPillars; ++i)
    {
        const offset = startOffset + i * PILLAR_SPACING;
        const nearRow = inner.rowStart + (runsAlongCols ? 0 : offset);
        const nearCol = inner.colStart + (runsAlongCols ? offset : 0);
        cells.push({row: nearRow, col: nearCol});
        cells.push(runsAlongCols
            ? {row: inner.rowStart + inner.numRows - 1, col: nearCol}
            : {row: nearRow, col: inner.colStart + inner.numCols - 1});
    }
    const prop = palette.propTextureIndex;
    return {volume: getArrangementVolume(inner, heightInLayers), cells,
        textureIndices: RoomGenerationHelperUtil.getBoxTextureIndices(prop, prop, prop)};
}

// A single low plinth at the space's centre.
function planCentrepiece(inner: RoomGenerationVolume, palette: RoomGenerationPalette): Arrangement
{
    const size = (inner.numRows >= CENTREPIECE_MIN_SIZE && inner.numCols >= CENTREPIECE_MIN_SIZE)
        ? 2 : 1;
    return {
        volume: getArrangementVolume(inner, PLINTH_HEIGHT),
        cells: RoomGenerationVolumeUtil.getCells({...inner,
            rowStart: inner.rowStart + Math.floor(0.5 * (inner.numRows - size)),
            colStart: inner.colStart + Math.floor(0.5 * (inner.numCols - size)),
            numRows: size, numCols: size,
        }),
        textureIndices: getPlinthTextureIndices(palette),
    };
}

// The same low block work, set out in the space's four corners instead.
function planCornerBlocks(inner: RoomGenerationVolume, palette: RoomGenerationPalette): Arrangement
{
    const cells: {row: number, col: number}[] = [];
    for (const row of [inner.rowStart, inner.rowStart + inner.numRows - 1])
    {
        for (const col of [inner.colStart, inner.colStart + inner.numCols - 1])
            cells.push({row, col});
    }
    return {volume: getArrangementVolume(inner, PLINTH_HEIGHT), cells,
        textureIndices: getPlinthTextureIndices(palette)};
}

// A plinth is only ever seen from the outside, so its sides carry the space's wall texture and
// only its exposed top gets the accent one.
function getPlinthTextureIndices(palette: RoomGenerationPalette): number[]
{
    return RoomGenerationHelperUtil.getBoxTextureIndices(
        palette.wallTextureIndex, palette.propTextureIndex, palette.wallTextureIndex);
}

export default RoomGenerationPropsUtil;
