import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../system/sharedConstants";
import RoomPalette from "../types/roomPalette";
import RoomVolume from "../types/roomVolume";

// Named volume shapes (purpose is a separate question; see RoomVolumeType).
export const RoomVolumeConstructorMap: {[roomVolumeShape: string]:
    (...params: any[]) => RoomVolume} =
{
    // Inside the boundary wall.
    "Interior": (): RoomVolume =>
    {
        return new RoomVolume(1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
    },
    // The legacy entrance doorway. No longer carved; still named by older-room conversions.
    "InitialMultiplayerEntrance": (): RoomVolume =>
    {
        const row = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW;
        const col = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL;

        return new RoomVolume(row, row, col, col,
            COLLISION_LAYER_MIN,
            COLLISION_LAYER_MIN + INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS - 1);
    },
    // A keep-clear zone around the entrance, spanning the entrance storey's full height (the doorway,
    // its wall and the arrival floor); the storey above stays buildable.
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