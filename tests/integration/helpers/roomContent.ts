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
import RoomGenerationVolume from "../../../src/shared/room/types/roomGeneration/roomGenerationVolume";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomGenerationSpaceUtil from "../../../src/shared/room/util/roomGenerationSpaceUtil";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomGenerationVolumeUtil from "../../../src/shared/room/util/roomGenerationVolumeUtil";
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";

const PALETTE = {
    floorTextureIndex: 0, wallTextureIndex: 1, ceilingTextureIndex: 2, propTextureIndex: 3,
};

/** Fills a room in as one open floor per storey inside the boundary wall, and nothing else. */
export function buildBareMultiplayerRoomContent(room: Room): void
{
    room.voxelGrid = VoxelGrid.createEmpty();
    room.objectGroup = new ObjectGroup([]);

    const footprint: RoomGenerationVolume = {
        ...RoomGenerationVolumeUtil.WHOLE_ROOM,
        rowStart: 1, colStart: 1, numRows: NUM_VOXEL_ROWS - 2, numCols: NUM_VOXEL_COLS - 2,
    };
    RoomGenerationSpaceUtil.build(room.voxelGrid, [
        ...[RoomGenerationVolumeUtil.GROUND_STOREY, RoomGenerationVolumeUtil.UPPER_STOREY].map(
            storey => ({volume: RoomGenerationVolumeUtil.intersect(footprint, storey), palette: PALETTE})),
        {volume: RoomGenerationVolumeUtil.MULTI_PLAYER_ENTRANCE, palette: PALETTE},
    ]);
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
