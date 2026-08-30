/**
 * Room content for test fixtures.
 *
 * Multiplayer rooms are generated procedurally when the server creates them, from a seed drawn at
 * creation time — great for the product, useless as a fixture: a scenario that builds and edits
 * blocks at chosen coordinates needs to know what is already there, and needs the same answer on
 * every run. So the fixtures below build the bare shell a multiplayer room used to be (floor,
 * ceiling, boundary wall, and the one door every room has) and nothing else, leaving the generator
 * itself to be covered by the tests written for it (see room-generation.test.ts).
 */
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import DoorObjectUtil from "../../../src/shared/object/util/doorObjectUtil";
import { RoomVolumeConstructorMap } from "../../../src/shared/room/generation/maps/roomVolumeConstructorMap";
import RoomPalette from "../../../src/shared/room/generation/types/roomPalette";
import RoomVolume from "../../../src/shared/room/generation/types/roomVolume";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import RoomVolumeUtil from "../../../src/shared/room/generation/util/roomVolumeUtil";
import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";

const PALETTE = new RoomPalette(0, 2, 1, 3); // (floor, ceiling, wall, prop)

/** Fills a room in as one open floor per storey inside the boundary wall, and nothing else. */
export function buildBareMultiplayerRoomContent(room: Room): void
{
    // A room starts as solid mass and is carved out of, so a fixture describes the space it wants
    // open rather than the walls around it — the boundary wall is simply the mass the carving is
    // kept away from.
    room.voxelGrid = VoxelGrid.createBaseGrid();
    room.objectGroup = new ObjectGroup([]);

    const voxels = room.voxelGrid.voxels;

    // Two open storeys with the dividing slab left standing between them. The upper one is carried
    // all the way to the room's own ceiling rather than stopping under a cap the way a generated
    // room does: this is a bare shell to test against, and a scenario about the room's own ceiling
    // tile needs that tile to be the thing overhead.
    RoomVolumeUtil.carveOutVolume(voxels, RoomVolumeConstructorMap["FirstStorey"](
        1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2, PALETTE));
    RoomVolumeUtil.carveOutVolume(voxels, new RoomVolume(
        1, NUM_VOXEL_ROWS - 2, 1, NUM_VOXEL_COLS - 2,
        STOREY_FLOOR_COLLISION_LAYER + 1, COLLISION_LAYER_MAX, PALETTE));

    // The way in, which is a door hung on the boundary wall — without it the room has none, and
    // an arriving player has nowhere to be put down (see SpawnHotspotUtil). Nothing is cut through
    // that wall: a door is a wall attachment, and an attachment needs the wall behind it.
    const entranceDoor = DoorObjectUtil.makeEntranceDoor(room.id,
        MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, COLLISION_LAYER_MIN);
    room.objectGroup.objectById[entranceDoor.objectId] = entranceDoor;
}

/** A fixture room of the given type. Single-player rooms keep their real template. */
export function createTestRoom(roomID: string, roomName: string, roomType: RoomType,
    ownerUserID: string = "", ownerUserName: string = "", texturePackPath: string = "default"): Room
{
    const room = new Room(roomID, roomName, roomType, ownerUserID, ownerUserName, texturePackPath,
        new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));

    if (roomType === RoomTypeEnumMap.SinglePlayer)
        RoomGenerationUtil.generateRoomContent(room);
    else
        buildBareMultiplayerRoomContent(room);

    return room;
}
