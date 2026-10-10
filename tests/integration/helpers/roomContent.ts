/**
 * Room fixtures: multiplayer scenarios get a bare shell (open storeys, boundary wall, entrance door) finished in
 * textures that tell its floor, walls and ceiling apart. Generation itself is tested in room-generation.test.ts.
 * Single-player rooms are read from their room files, as the game reads them.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import BufferState from "../../../src/shared/networking/types/bufferState";
import RoomFile from "../../../src/shared/room/types/roomFile";
import SinglePlayerModeConfigMap from "../../../src/shared/singlePlayer/maps/singlePlayerModeConfigMap";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import RoomPalette from "../../../src/shared/room/types/roomPalette";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomVolumeUtil from "../../../src/shared/room/util/roomVolumeUtil";
import Room from "../../../src/shared/room/types/room";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { COLLISION_LAYER_MAX, INITIAL_MULTI_PLAYER_ENTRANCE_POS } from "../../../src/shared/system/sharedConstants";
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

    // A generated room's two storeys with the slab between; the upper one reaches the room ceiling (unlike a
    // generated room's), so ceiling-tile scenarios work.
    const [lower, upper] = RoomGenerationUtil.getStoreys();
    RoomVolumeUtil.carveOutVolume(grid.voxels, lower, PALETTE);
    RoomVolumeUtil.carveOutVolume(grid.voxels, new RoomVolume(upper.rowMin, upper.rowMax, upper.colMin, upper.colMax,
        upper.collisionLayerMin, COLLISION_LAYER_MAX), PALETTE);
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

/** The bytes of a single-player room's file, unzipped (see RoomFile). */
export function readSinglePlayerRoomFileBytes(roomPath: string): Uint8Array
{
    const fileBytes = fs.readFileSync(path.join(process.cwd(), "public/app/assets/rooms",
        `${roomPath}${RoomFile.FILE_EXTENSION}`));
    return new Uint8Array(RoomFile.isGzipped(fileBytes) ? zlib.gunzipSync(fileBytes) : fileBytes);
}

/** Fills a single-player room in from its mode's room file, as the client does on entering it. */
export function loadSinglePlayerRoomContent(room: Room): void
{
    const roomFile = RoomFile.decodeWithParams(new BufferState(
        readSinglePlayerRoomFileBytes(SinglePlayerModeConfigMap[room.roomName].roomPath)), room.id) as RoomFile;
    room.voxelGrid = roomFile.voxelGrid;
    room.objectGroup = roomFile.objectGroup;
    room.texturePackPath = roomFile.texturePackPath;
    room.prefs = roomFile.prefs;
}

/** A fixture room of the given type. Single-player rooms keep their real content. */
export function createTestRoom(roomID: string, roomName: string, roomType: RoomType,
    ownerUserID: string = "", ownerUserName: string = "", texturePackPath: string = "default"): Room
{
    const room = new Room(roomID, roomName, roomType, ownerUserID, ownerUserName, texturePackPath,
        RoomPrefsUtil.getDefaultPrefsString(),
        new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));

    if (roomType === RoomTypeEnumMap.SinglePlayer)
        loadSinglePlayerRoomContent(room);
    else
        buildBareMultiplayerRoomContent(room);

    return room;
}
