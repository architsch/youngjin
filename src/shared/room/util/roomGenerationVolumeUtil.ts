import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS,
    MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../system/sharedConstants";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";

// The arithmetic done on the boxes a room is laid out in (see RoomGenerationVolume). Every routine
// in the system works in these, so the handful of questions ever asked of one are answered here
// rather than re-derived wherever a routine happens to need one.
//
// A volume may come out empty (i.e. with a non-positive extent), which everything here treats as
// covering nothing at all rather than as an error: "nothing fits in here" is an ordinary answer
// when a room's spaces are small.
const RoomGenerationVolumeUtil =
{
    // The room at each of its heights: the ground floor, the floor above it, and — for a space
    // standing open from the room's own floor to its own ceiling — both of them at once. A
    // footprint is put on one of these by meeting it with it, which is all it takes to make a room
    // one storey or two.
    GROUND_STOREY: getStorey(COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER - 1),
    UPPER_STOREY: getStorey(STOREY_FLOOR_COLLISION_LAYER + 1, COLLISION_LAYER_MAX),
    WHOLE_ROOM: getStorey(COLLISION_LAYER_MIN, COLLISION_LAYER_MAX),

    // The doorway a player arrives through, which is a space like any other: a cavity for passage,
    // cut through the boundary wall to a doorway's height. Every multiplayer room has to be built
    // with it, or it ends up with no way in.
    MULTI_PLAYER_ENTRANCE: {
        rowStart: MULTI_PLAYER_ENTRANCE_VOXEL_ROW, colStart: MULTI_PLAYER_ENTRANCE_VOXEL_COL,
        numRows: 1, numCols: 1,
        collisionLayerStart: COLLISION_LAYER_MIN,
        numCollisionLayers: MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS,
    },

    // One block of the room, as a volume — for asking a volume-shaped question about a single
    // block, such as whether editing is kept out of where it stands.
    getBlockVolume(row: number, col: number, collisionLayer: number): RoomGenerationVolume
    {
        return {rowStart: row, colStart: col, numRows: 1, numCols: 1,
            collisionLayerStart: collisionLayer, numCollisionLayers: 1};
    },

    // The topmost layer the volume reaches, and the two layer positions that close it off from
    // below and from above. Either of the latter may fall outside the collision layers altogether,
    // which is where the room's own floor and ceiling close a volume off instead of a slab of
    // blocks — see COLLISION_LAYER_NULL.
    getCollisionLayerMax(volume: RoomGenerationVolume): number
    {
        return volume.collisionLayerStart + volume.numCollisionLayers - 1;
    },

    getFloorCollisionLayer(volume: RoomGenerationVolume): number
    {
        return volume.collisionLayerStart - 1;
    },

    getCeilingCollisionLayer(volume: RoomGenerationVolume): number
    {
        return RoomGenerationVolumeUtil.getCollisionLayerMax(volume) + 1;
    },

    // Whether the volume stands over a cell of the floor, at any height at all. Every routine that
    // keeps something clear of somewhere — the floor in front of the entrance, the run of a
    // staircase — asks it this way, since what is being kept clear is kept clear all the way up.
    coversCell(volume: RoomGenerationVolume, row: number, col: number): boolean
    {
        return row >= volume.rowStart && row < volume.rowStart + volume.numRows &&
            col >= volume.colStart && col < volume.colStart + volume.numCols;
    },

    coveredByAny(volumes: RoomGenerationVolume[], row: number, col: number): boolean
    {
        return volumes.some(volume => RoomGenerationVolumeUtil.coversCell(volume, row, col));
    },

    // Whether two volumes share any space at all.
    overlaps(a: RoomGenerationVolume, b: RoomGenerationVolume): boolean
    {
        return !RoomGenerationVolumeUtil.isEmpty(RoomGenerationVolumeUtil.intersect(a, b));
    },

    overlapsAny(volumes: RoomGenerationVolume[], volume: RoomGenerationVolume): boolean
    {
        return volumes.some(other => RoomGenerationVolumeUtil.overlaps(other, volume));
    },

    // The space two volumes share, which may well be none. Meeting a footprint with one of the
    // storeys above is how a space is put on one floor of the room.
    intersect(a: RoomGenerationVolume, b: RoomGenerationVolume): RoomGenerationVolume
    {
        const rowStart = Math.max(a.rowStart, b.rowStart);
        const colStart = Math.max(a.colStart, b.colStart);
        const collisionLayerStart = Math.max(a.collisionLayerStart, b.collisionLayerStart);
        return {
            rowStart, colStart, collisionLayerStart,
            numRows: Math.min(a.rowStart + a.numRows, b.rowStart + b.numRows) - rowStart,
            numCols: Math.min(a.colStart + a.numCols, b.colStart + b.numCols) - colStart,
            numCollisionLayers: Math.min(a.collisionLayerStart + a.numCollisionLayers,
                b.collisionLayerStart + b.numCollisionLayers) - collisionLayerStart,
        };
    },

    // Shrinks a volume inwards on all four sides of its footprint, which is how a routine keeps
    // whatever it places away from the edges of the space it was given. The height is left alone:
    // a space is closed off above and below by the room itself, not by the margin its contents are
    // asked to keep.
    inset(volume: RoomGenerationVolume, margin: number): RoomGenerationVolume
    {
        return {
            ...volume,
            rowStart: volume.rowStart + margin,
            colStart: volume.colStart + margin,
            numRows: volume.numRows - 2 * margin,
            numCols: volume.numCols - 2 * margin,
        };
    },

    // Grows a volume outwards on all four sides, which is how the ring of cells around something
    // becomes part of what it claims — a stairwell plus the floor it is walked onto from.
    expand(volume: RoomGenerationVolume, margin: number): RoomGenerationVolume
    {
        return RoomGenerationVolumeUtil.inset(volume, -margin);
    },

    isEmpty(volume: RoomGenerationVolume): boolean
    {
        return volume.numRows < 1 || volume.numCols < 1 || volume.numCollisionLayers < 1;
    },

    // Every cell of the volume's footprint, row by row. What the volume does over each of them
    // across its height is the caller's business.
    getCells(volume: RoomGenerationVolume): {row: number, col: number}[]
    {
        const cells: {row: number, col: number}[] = [];
        for (let row = volume.rowStart; row < volume.rowStart + volume.numRows; ++row)
        {
            for (let col = volume.colStart; col < volume.colStart + volume.numCols; ++col)
                cells.push({row, col});
        }
        return cells;
    },
}

// The whole room over one stretch of its height.
function getStorey(collisionLayerStart: number, collisionLayerMax: number): RoomGenerationVolume
{
    return {
        rowStart: 0, colStart: 0, numRows: NUM_VOXEL_ROWS, numCols: NUM_VOXEL_COLS,
        collisionLayerStart, numCollisionLayers: collisionLayerMax - collisionLayerStart + 1,
    };
}

export default RoomGenerationVolumeUtil;
