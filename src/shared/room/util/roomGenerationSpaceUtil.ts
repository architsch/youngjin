import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import RoomGenerationSpace from "../types/roomGeneration/roomGenerationSpace";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Turns the spaces a room is described as into the blocks it is made of.
//
// A room starts out as solid mass, and its spaces are what is taken out of that mass. So nothing
// here builds a wall, a floor slab or a ceiling: each of those is whatever mass a space did not
// reach, and every one of them appears simply because a space stopped where it did. What is left
// to do afterwards is to finish the surfaces the spaces now meet, since a face only means anything
// once it is known which space is looking at it.
//
// See @docs/geometry/room_generation.md .
const RoomGenerationSpaceUtil =
{
    build: (voxelGrid: VoxelGrid, spaces: RoomGenerationSpace[]): void =>
    {
        const openLayerMasks = getOpenLayerMasks(spaces);
        const topCollisionLayer = getTopCollisionLayer(spaces);

        // The mass, everywhere no space reached.
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const openLayerMask = openLayerMasks[row * NUM_VOXEL_COLS + col];
                for (let layer = COLLISION_LAYER_MIN; layer <= topCollisionLayer; ++layer)
                {
                    if ((openLayerMask & (1 << layer)) == 0)
                    {
                        RoomGenerationHelperUtil.addWall(voxelGrid.voxels, row, col, undefined,
                            layer, layer);
                    }
                }
            }
        }

        // The surfaces, once every block of the room stands where it finally stands: whether a
        // face is drawn at all depends on what ended up next to it.
        for (const space of spaces)
            finishSurfaces(voxelGrid, space);

        // The roof. A room built no higher than its own spaces reach is capped by mass rather than
        // by the room's ceiling, and nothing stands above that cap for anyone to be looking at it
        // from — so its upward faces are left undrawn, and a camera drawn back far enough to look
        // down at the room is shown the room instead of a lid over it.
        if (topCollisionLayer < COLLISION_LAYER_MAX)
        {
            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    RoomGenerationHelperUtil.hideUpwardFace(voxelGrid.voxels, row, col, topCollisionLayer);
            }
        }
    },
}

// How high the room's mass is built, which is as high as its spaces reach and no higher. A room
// described with a ground storey alone therefore comes out capped by the slab that would have
// carried the floor above it, with nothing standing in the empty height over that.
function getTopCollisionLayer(spaces: RoomGenerationSpace[]): number
{
    let topCollisionLayer = COLLISION_LAYER_MIN;
    for (const space of spaces)
    {
        topCollisionLayer = Math.max(topCollisionLayer, Math.min(COLLISION_LAYER_MAX,
            RoomGenerationVolumeUtil.getCeilingCollisionLayer(space.volume)));
    }
    return topCollisionLayer;
}

// Which layers of each cell of the grid stand open, as one bitmask per cell. Spaces are free to
// overlap and to be listed in any order: a cell is open wherever any of them reached it.
function getOpenLayerMasks(spaces: RoomGenerationSpace[]): number[]
{
    const openLayerMasks = new Array<number>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS).fill(0);
    for (const space of spaces)
    {
        let mask = 0;
        const collisionLayerMax = Math.min(COLLISION_LAYER_MAX,
            RoomGenerationVolumeUtil.getCollisionLayerMax(space.volume));
        for (let layer = Math.max(COLLISION_LAYER_MIN, space.volume.collisionLayerStart);
            layer <= collisionLayerMax; ++layer)
        {
            mask |= (1 << layer);
        }

        for (const {row, col} of RoomGenerationVolumeUtil.getCells(space.volume))
        {
            if (row >= 0 && row < NUM_VOXEL_ROWS && col >= 0 && col < NUM_VOXEL_COLS)
                openLayerMasks[row * NUM_VOXEL_COLS + col] |= mask;
        }
    }
    return openLayerMasks;
}

// Finishes everything enclosing one space: the floor under it, the ceiling over it, and the walls
// around it, each in the space's own palette.
function finishSurfaces(voxelGrid: VoxelGrid, space: RoomGenerationSpace): void
{
    const {volume, palette} = space;

    for (const {row, col} of RoomGenerationVolumeUtil.getCells(volume))
    {
        paintEnclosingFace(voxelGrid, row, col, "y", "+",
            RoomGenerationVolumeUtil.getFloorCollisionLayer(volume), palette.floorTextureIndex);
        paintEnclosingFace(voxelGrid, row, col, "y", "-",
            RoomGenerationVolumeUtil.getCeilingCollisionLayer(volume), palette.ceilingTextureIndex);
    }

    const collisionLayerMax = RoomGenerationVolumeUtil.getCollisionLayerMax(volume);
    for (const {row, col, facingAxis, orientation} of getEnclosingCells(volume))
    {
        for (let layer = volume.collisionLayerStart; layer <= collisionLayerMax; ++layer)
            paintEnclosingFace(voxelGrid, row, col, facingAxis, orientation, layer, palette.wallTextureIndex);
    }
}

// Finishes one face of whatever encloses a space. The face belongs to the enclosing block rather
// than to the space itself, and is drawn only where there is such a block — where two spaces meet
// there is no surface between them at all, and where the room's own floor or ceiling closes a
// space off, the face that draws it is always on show.
function paintEnclosingFace(voxelGrid: VoxelGrid, row: number, col: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
    textureIndex: number): void
{
    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
    if (voxel == undefined)
        return; // outside the room, where there is no face to finish

    RoomGenerationHelperUtil.paintFace(voxelGrid.voxels, row, col, facingAxis, orientation,
        getQuadCollisionLayer(collisionLayer), textureIndex,
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer));
}

// The room's own floor and ceiling are not collision layers, so the faces that draw them are
// addressed by the one layer position that stands for both ends of the stack.
function getQuadCollisionLayer(collisionLayer: number): number
{
    return (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        ? COLLISION_LAYER_NULL : collisionLayer;
}

// The cells enclosing a volume from each of its four sides, each together with the face of it that
// looks back in. A cell may lie outside the room altogether, which is passed over above.
function getEnclosingCells(volume: RoomGenerationVolume):
    {row: number, col: number, facingAxis: "x" | "z", orientation: "-" | "+"}[]
{
    const cells: {row: number, col: number, facingAxis: "x" | "z", orientation: "-" | "+"}[] = [];
    const rowEnd = volume.rowStart + volume.numRows;
    const colEnd = volume.colStart + volume.numCols;

    for (let row = volume.rowStart; row < rowEnd; ++row)
    {
        cells.push({row, col: volume.colStart - 1, facingAxis: "x", orientation: "+"});
        cells.push({row, col: colEnd, facingAxis: "x", orientation: "-"});
    }
    for (let col = volume.colStart; col < colEnd; ++col)
    {
        cells.push({row: volume.rowStart - 1, col, facingAxis: "z", orientation: "+"});
        cells.push({row: rowEnd, col, facingAxis: "z", orientation: "-"});
    }
    return cells;
}

export default RoomGenerationSpaceUtil;
