/**
 * Room content for test fixtures.
 *
 * Multiplayer rooms are generated procedurally when the server creates them, from a seed drawn at
 * creation time — great for the product, useless as a fixture: a scenario that builds and edits
 * blocks at chosen coordinates needs to know what is already there, and needs the same answer on
 * every run. So the fixtures below build the bare shell a multiplayer room used to be (floor,
 * ceiling, boundary wall, entrance) and nothing else, leaving the generator itself to be covered
 * by the tests written for it (see room-generation.test.ts).
 */
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import Room from "../../../src/shared/room/types/room";
import RoomGenerationVoxelGrid from "../../../src/shared/room/types/roomGeneration/roomGenerationVoxelGrid";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomGenerationHelperUtil from "../../../src/shared/room/util/roomGenerationHelperUtil";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";

const FLOOR_TEXTURE_INDEX = 0;
const WALL_TEXTURE_INDEX = 1;
const CEILING_TEXTURE_INDEX = 2;

/** Fills a room in as one open floor inside the boundary wall, and nothing else. */
export function buildBareMultiplayerRoomContent(room: Room): void
{
    room.voxelGrid = VoxelGrid.createEmpty();
    room.objectGroup = new ObjectGroup([]);

    const grid = new RoomGenerationVoxelGrid();
    grid.createRegion(1, 1, NUM_VOXEL_ROWS - 2, NUM_VOXEL_COLS - 2,
        FLOOR_TEXTURE_INDEX, CEILING_TEXTURE_INDEX, WALL_TEXTURE_INDEX);
    grid.generate(room.voxelGrid);
    RoomGenerationHelperUtil.carveMultiplayerEntrance(room.voxelGrid.voxels);
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
