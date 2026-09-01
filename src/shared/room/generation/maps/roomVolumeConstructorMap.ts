import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../system/sharedConstants";
import RoomPalette from "../types/roomPalette";
import RoomVolume from "../types/roomVolume";

// The vocabulary of shapes a room is described in. A shape is what a volume looks like; what it is
// there for is a separate question, answered by RoomVolumeType.
export const RoomVolumeConstructorMap: {[roomVolumeShape: string]:
    (...params: any[]) => RoomVolume} =
{
    // Everything inside the room's boundary: the outermost row and column on each side are the
    // boundary wall itself, which is never anything a room is built in.
    "Interior": (): RoomVolume =>
    {
        return new RoomVolume(1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
    },
    // The doorway a multiplayer room used to be entered through. Nothing carves this any more — a
    // room's way in is a door hung on the boundary wall rather than a hole cut through it — but the
    // conversions that carry older rooms across still need to name that stretch, to cut it out of a
    // room that predates the hole and to fill it back in on a room that has one.
    "InitialMultiplayerEntrance": (): RoomVolume =>
    {
        const row = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW;
        const col = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL;

        return new RoomVolume(row, row, col, col,
            COLLISION_LAYER_MIN,
            COLLISION_LAYER_MIN + INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS - 1);
    },
    // A stretch of the room around the entrance, reaching the given number of cells out to either
    // side of it and the given number in front of and behind it.
    //
    // It stands as high as the storey the entrance opens onto, rather than only as high as the
    // doorway. Everything such a zone exists to protect is on that storey - the doorway, the wall
    // framing it (which carries on above the opening), and the floor an arriving player spawns on -
    // while the room above it is ordinary room, somewhere an owner should be as free to build as
    // anywhere else and which nobody can even reach the doorway from.
    "InitialMultiplayerEntranceZone": (halfWidth: number, halfDepth: number): RoomVolume =>
    {
        const row = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW;
        const col = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL;

        return new RoomVolume(row - halfDepth, row + halfDepth, col - halfWidth, col + halfWidth,
            COLLISION_LAYER_MIN,
            COLLISION_LAYER_MIN + NUM_COLLISION_LAYERS_PER_STOREY - 1);
    },
    "SingleBlock": (row: number, col: number, collisionLayer: number): RoomVolume =>
    {
        return new RoomVolume(row, row, col, col, collisionLayer, collisionLayer);
    },
    "FirstStorey": (rowMin: number, rowMax: number, colMin: number, colMax: number, palette: RoomPalette): RoomVolume =>
    {
        return new RoomVolume(rowMin, rowMax, colMin, colMax,
            COLLISION_LAYER_MIN,
            COLLISION_LAYER_MIN + NUM_COLLISION_LAYERS_PER_STOREY - 1,
            palette);
    },
    "SecondStorey": (rowMin: number, rowMax: number, colMin: number, colMax: number, palette: RoomPalette): RoomVolume =>
    {
        return new RoomVolume(rowMin, rowMax, colMin, colMax,
            STOREY_FLOOR_COLLISION_LAYER + 1,
            STOREY_FLOOR_COLLISION_LAYER + NUM_COLLISION_LAYERS_PER_STOREY,
            palette);
    },
    "BothStoreys": (rowMin: number, rowMax: number, colMin: number, colMax: number, palette: RoomPalette): RoomVolume =>
    {
        return new RoomVolume(rowMin, rowMax, colMin, colMax,
            COLLISION_LAYER_MIN,
            NUM_COLLISION_LAYERS - 2, // subtracting 2 instead of 1 here, since the topmost layer of blocks must be a padding beneath the actual ceiling (i.e. null-layer voxel quads) in order to make sure that the first storey's height and the second storey's height are identical (= 7).
            palette);
    },
}