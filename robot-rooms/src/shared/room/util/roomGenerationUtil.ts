import ObjectGroup from "../../object/types/objectGroup";
import DoorObjectTypeConfig from "../../object/types/objectTypeConfig/doorObjectTypeConfig";
import { COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, INITIAL_MULTI_PLAYER_ENTRANCE_POS,
    NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER } from "../../system/sharedConstants";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../voxel/types/voxelQuadsRuntimeMemory";
import Room from "../types/room";
import RoomPalette from "../types/roomPalette";
import { RoomType } from "../types/roomType";
import RoomVolume from "../types/roomVolume";
import RoomPrefsUtil from "./roomPrefsUtil";
import RoomVolumeUtil from "./roomVolumeUtil";

// What a generated room is finished in: one texture of the plainest pack, everywhere.
const TEXTURE_PACK_PATH = "default";
const PALETTE = new RoomPalette(0, 0, 0, 0);

// Every room a server makes is born here, empty, for whoever uses it to build in (see
// @docs/geometry/room_generation.md): so every room-level parameter must be decided here.
const RoomGenerationUtil =
{
    // Makes a room an empty one, leaving its identity untouched (works on existing descriptors too): two open
    // storeys inside its boundary wall, with the slab between them, and the door that is its way in.
    generateRoomContent: (room: Room): void =>
    {
        room.texturePackPath = TEXTURE_PACK_PATH;
        room.voxelGrid = VoxelGrid.createBaseGrid();
        for (const storey of getStoreys())
            RoomVolumeUtil.carveOutVolume(room.voxelGrid.voxels, storey, PALETTE);

        // After carving, once the wall it hangs on is all that is left there. A room without one can't be left.
        room.objectGroup = new ObjectGroup([
            DoorObjectTypeConfig.util.makeEntranceDoor(room.id, INITIAL_MULTI_PLAYER_ENTRANCE_POS)]);
    },
    // A new empty room; the DB assigns its ID.
    generateRoom: (roomName: string, roomType: RoomType,
        ownerUserID: string = "", ownerUserName: string = ""): Room =>
    {
        // Atmosphere is written explicitly (the documented defaults) rather than left empty, including
        // tuned cloud values at zero opacity (see @docs/graphics/lighting.md).
        const room = new Room(undefined, roomName, roomType, ownerUserID, ownerUserName,
            "", RoomPrefsUtil.getDefaultPrefsString(),
            new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        RoomGenerationUtil.generateRoomContent(room);
        return room;
    },
    // The open space of each of a generated room's storeys, the lower first.
    getStoreys,
}

// The upper one stops a layer short of the room's ceiling, so that both are as high.
function getStoreys(): RoomVolume[]
{
    const rowMax = NUM_VOXEL_ROWS - 1 - GENERATED_WALL_THICKNESS;
    const colMax = NUM_VOXEL_COLS - 1 - GENERATED_WALL_THICKNESS;
    return [COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER + 1].map(collisionLayerMin => new RoomVolume(
        GENERATED_WALL_THICKNESS, rowMax, GENERATED_WALL_THICKNESS, colMax,
        collisionLayerMin, collisionLayerMin + NUM_COLLISION_LAYERS_PER_STOREY - 1));
}

export default RoomGenerationUtil;
