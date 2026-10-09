import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../system/sharedConstants";
import RoomPalette from "../types/roomPalette";
import RoomVolume from "../types/roomVolume";

// Named volume shapes (purpose is a separate question; see RoomVolumeType).
export const RoomVolumeConstructorMap: {[roomVolumeShape: string]:
    (...params: any[]) => RoomVolume} =
{
    // Inside the boundary wall.
    "Interior": (): RoomVolume =>
    {
        return new RoomVolume(
            GENERATED_WALL_THICKNESS, NUM_VOXEL_ROWS - 1 - GENERATED_WALL_THICKNESS,
            GENERATED_WALL_THICKNESS, NUM_VOXEL_COLS - 1 - GENERATED_WALL_THICKNESS,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
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