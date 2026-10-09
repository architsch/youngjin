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
import { COLLISION_LAYER_MAX, INITIAL_MULTI_PLAYER_ENTRANCE_POS,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";

const PALETTE = new RoomPalette(0, 2, 1, 3); // (floor, ceiling, wall, prop)

// The bare shell as it was first carved, to copy from: carving it is thousands of block edits, and nearly
// every scenario starts from one.
let bareGridTemplate: {quads: Uint8Array, blockLayerMasks: number[]} | undefined;

function carveBareGrid(): VoxelGrid
{
    // Start solid and carve the open space.
    const grid = VoxelGrid.createBaseGrid();

    // Two open storeys with the slab between; the upper one reaches the room ceiling (unlike generated
    // rooms), so ceiling-tile scenarios work.
    const {rowMin, rowMax, colMin, colMax} = RoomVolumeConstructorMap["Interior"]();
    RoomVolumeUtil.carveOutVolume(grid.voxels, RoomVolumeConstructorMap["FirstStorey"](
        rowMin, rowMax, colMin, colMax, PALETTE));
    RoomVolumeUtil.carveOutVolume(grid.voxels, new RoomVolume(
        rowMin, rowMax, colMin, colMax,
        STOREY_FLOOR_COLLISION_LAYER + 1, COLLISION_LAYER_MAX, PALETTE));
    return grid;
}

/** Fills a room in as one open floor per storey inside the boundary wall, and nothing else. */
export function buildBareMultiplayerRoomContent(room: Room): void
{
    room.voxelGrid = VoxelGrid.createBaseGrid();
    room.objectGroup = new ObjectGroup([]);

    if (bareGridTemplate == undefined)
    {
        const carved = carveBareGrid();
        bareGridTemplate = {quads: carved.quadsMem.quads.slice(),
            blockLayerMasks: carved.voxels.map(voxel => voxel.blockLayerMask)};
    }
    room.voxelGrid.quadsMem.quads.set(bareGridTemplate.quads);
    room.voxelGrid.voxels.forEach((voxel, i) => { voxel.blockLayerMask = bareGridTemplate!.blockLayerMasks[i]; });

    // The entrance door on the boundary wall (needed for spawning; see SpawnHotspotUtil).
    room.objectGroup.addObject(
        DoorObjectTypeConfig.util.makeEntranceDoor(room.id, INITIAL_MULTI_PLAYER_ENTRANCE_POS));
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
