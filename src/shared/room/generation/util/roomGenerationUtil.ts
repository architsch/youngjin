import SinglePlayerModeConfigMap from "../../../singlePlayer/maps/singlePlayerModeConfigMap";
import ObjectGroup from "../../../object/types/objectGroup";
import VoxelGrid from "../../../voxel/types/voxelGrid";
import Room from "../../types/room";
import { RoomType, RoomTypeEnumMap } from "../../types/roomType";
import HubRoomBuilder from "../types/builder/hubRoomBuilder";
import RegularRoomBuilder from "../types/builder/regularRoomBuilder";
import RandomNumberGenerator from "../../../math/types/randomNumberGenerator";
import VoxelQuadsRuntimeMemory from "../../../voxel/types/voxelQuadsRuntimeMemory";
import RoomBuilderParams from "../types/params/roomBuilderParams";
import RoomPaletteSelectionParams from "../types/params/roomPaletteSelectionParams";
import RoomPalette from "../types/roomPalette";
import RoomPaletteMap from "../maps/roomPaletteMap";
import RoomPrefsUtil from "../../util/roomPrefsUtil";
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../../system/sharedConstants";

const RoomGenerationUtil =
{
    // Generates a room's content and room-level parameters, leaving its identity untouched (works on
    // existing descriptors too). Every room-level parameter must be decided here (see
    // @docs/geometry/room_generation.md). A seed reproduces a multiplayer room; it isn't stored.
    generateRoomContent: (room: Room, seed?: number): void =>
    {
        room.voxelGrid = VoxelGrid.createBaseGrid();
        room.objectGroup = new ObjectGroup([]);

        switch (room.roomType)
        {
            case RoomTypeEnumMap.Hub:
                new HubRoomBuilder(
                    makeMultiplayerRoomBuilderParams(HUB_PALETTE_SELECTION, seed), room).run();
                break;
            case RoomTypeEnumMap.Regular:
                new RegularRoomBuilder(
                    makeMultiplayerRoomBuilderParams(REGULAR_PALETTE_SELECTION, seed), room).run();
                break;
            case RoomTypeEnumMap.SinglePlayer:
                // (roomName == singlePlayerMode) if the room is a singleplayer room.
                SinglePlayerModeConfigMap[room.roomName].buildRoom(room);
                break;
            default: throw new Error(`Unknown room type :: ${room.roomType}`);
        }
    },
    // A new generated room; the DB assigns its ID.
    generateRoom: (roomName: string, roomType: RoomType,
        ownerUserID: string = "", ownerUserName: string = "", seed?: number): Room =>
    {
        // Atmosphere is written explicitly (the documented defaults) rather than left empty, including
        // tuned cloud values at zero opacity (see @docs/graphics/lighting.md).
        const room = new Room(undefined, roomName, roomType, ownerUserID, ownerUserName,
            "", RoomPrefsUtil.getDefaultPrefsString(),
            new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        RoomGenerationUtil.generateRoomContent(room, seed);
        return room;
    },
}

// Hubs are decorated: any pack, with that pack's curated palettes (no palettes listed = a random pack).
const HUB_PALETTE_SELECTION: RoomPaletteSelectionParams = {
    texturePackPaths: RoomPaletteMap.getTexturePackPaths(),
    palettes: [],
};

// Regular rooms are plain: one texture everywhere, a blank room for the owner to decorate.
const PLAIN_TEXTURE_PACK_PATH = "default";
const PLAIN_TEXTURE_INDEX = 0;
const REGULAR_PALETTE_SELECTION: RoomPaletteSelectionParams = {
    texturePackPaths: [PLAIN_TEXTURE_PACK_PATH],
    palettes: [new RoomPalette(PLAIN_TEXTURE_INDEX, PLAIN_TEXTURE_INDEX, PLAIN_TEXTURE_INDEX,
        PLAIN_TEXTURE_INDEX)],
};

// Builder params for procedural multiplayer rooms (the counterpart of a SinglePlayerModeConfig): a
// fixed entrance, the type's palette selection, everything else drawn.
function makeMultiplayerRoomBuilderParams(paletteSelection: RoomPaletteSelectionParams,
    seed?: number): RoomBuilderParams
{
    return {
        entranceVoxelCol: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
        entranceVoxelRow: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
        entranceVoxelCollisionLayer: COLLISION_LAYER_MIN,
        paletteSelection,
        hotspots: {},
        volumes: {},
        rand: new RandomNumberGenerator(seed),
    };
}

export default RoomGenerationUtil;
