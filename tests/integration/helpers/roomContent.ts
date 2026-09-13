/**
 * Deterministic room fixtures: generated rooms are random, so scenarios get a bare shell (open storeys,
 * boundary wall, entrance door). Generation itself is tested in room-generation.test.ts.
 */
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { RoomVolumeConstructorMap } from "../../../src/shared/room/generation/maps/roomVolumeConstructorMap";
import RoomPalette from "../../../src/shared/room/generation/types/roomPalette";
import RoomVolume from "../../../src/shared/room/generation/types/roomVolume";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import RoomVolumeUtil from "../../../src/shared/room/generation/util/roomVolumeUtil";
import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";

const PALETTE = new RoomPalette(0, 2, 1, 3); // (floor, ceiling, wall, prop)

/** Fills a room in as one open floor per storey inside the boundary wall, and nothing else. */
export function buildBareMultiplayerRoomContent(room: Room): void
{
    // Start solid and carve the open space.
    room.voxelGrid = VoxelGrid.createBaseGrid();
    room.objectGroup = new ObjectGroup([]);

    const voxels = room.voxelGrid.voxels;

    // Two open storeys with the slab between; the upper one reaches the room ceiling (unlike generated
    // rooms), so ceiling-tile scenarios work.
    RoomVolumeUtil.carveOutVolume(voxels, RoomVolumeConstructorMap["FirstStorey"](
        1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2, PALETTE));
    RoomVolumeUtil.carveOutVolume(voxels, new RoomVolume(
        1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2,
        STOREY_FLOOR_COLLISION_LAYER + 1, COLLISION_LAYER_MAX, PALETTE));

    // The entrance door on the boundary wall (needed for spawning; see SpawnHotspotUtil).
    const entranceDoor = DoorObjectTypeConfig.util.makeEntranceDoor(room.id,
        INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, COLLISION_LAYER_MIN);
    room.objectGroup.objectById[entranceDoor.objectId] = entranceDoor;
}

/** A fixture room of the given type. Single-player rooms keep their real template. */
export function createTestRoom(roomID: string, roomName: string, roomType: RoomType,
    ownerUserID: string = "", ownerUserName: string = "", texturePackPath: string = "default"): Room
{
    const room = new Room(roomID, roomName, roomType, ownerUserID, ownerUserName, texturePackPath,
        RoomPrefsUtil.getDefaultPrefsString(),
        new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));

    if (roomType === RoomTypeEnumMap.SinglePlayer)
        RoomGenerationUtil.generateRoomContent(room);
    else
        buildBareMultiplayerRoomContent(room);

    return room;
}
