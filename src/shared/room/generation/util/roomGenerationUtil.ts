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
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../../system/sharedConstants";

const RoomGenerationUtil =
{
    // Fills in everything about a room that generation gets to decide: the voxels it is built
    // out of, the objects it comes furnished with, and the room-level parameters those were
    // chosen to suit. The room's identity (ID, name, type, owner) is left untouched, so this can
    // be run over a room that already exists as a descriptor as well as over a brand new one.
    //
    // Every room-level parameter belongs here. One that no generator sets is one that every room
    // in the game is silently left holding its default value for — see
    // @docs/geometry/room_generation.md .
    //
    // A multiplayer room is laid out from a seed, so that no two rooms open on the same interior.
    // Passing one rebuilds exactly the same room; leaving it out draws a fresh one. The seed is not
    // kept: the room it produced is saved as ordinary content, and is edited from then on like any
    // other room's.
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
    // A brand new room of the given type, generated and ready to be stored. Its ID stays empty
    // until the DB assigns one.
    generateRoom: (roomName: string, roomType: RoomType,
        ownerUserID: string = "", ownerUserName: string = "", seed?: number): Room =>
    {
        const room = new Room(undefined, roomName, roomType, ownerUserID, ownerUserName,
            "", new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        RoomGenerationUtil.generateRoomContent(room, seed);
        return room;
    },
}

// A hub is the room the game hands to everybody, and the first one most players ever stand in, so
// it is worth decorating: any of the packs the game ships, finished in whichever palettes were
// hand-picked for the one it draws. Naming no palettes is what asks for those — and it is the only
// way to ask for a pack at random, since a palette written out here would be a set of positions in
// an atlas nobody yet knows.
const HUB_PALETTE_SELECTION: RoomPaletteSelectionParams = {
    texturePackPaths: RoomPaletteMap.getTexturePackPaths(),
    palettes: [],
};

// A regular room belongs to one person, so it comes out plain: the one texture, on every face of
// every block in it. What its owner starts from is then a blank room to decorate, rather than one
// that arrived already decorated in somebody else's taste — which suits a room that is mostly solid
// mass to be mined out block by block in the first place. A single candidate of each is all it
// takes to say so, since a draw with one thing to draw from returns that thing every time.
const PLAIN_TEXTURE_PACK_PATH = "default";
const PLAIN_TEXTURE_INDEX = 0;
const REGULAR_PALETTE_SELECTION: RoomPaletteSelectionParams = {
    texturePackPaths: [PLAIN_TEXTURE_PACK_PATH],
    palettes: [new RoomPalette(PLAIN_TEXTURE_INDEX, PLAIN_TEXTURE_INDEX, PLAIN_TEXTURE_INDEX,
        PLAIN_TEXTURE_INDEX)],
};

// What a procedurally generated multiplayer room is built from. Its entrance is the one fixed cell
// every multiplayer room shares, its look is whatever the room type allows it to be finished in,
// and everything else about it is drawn rather than declared.
//
// This is the multiplayer counterpart of a SinglePlayerModeConfig: the one place a room-level
// parameter is named for a Hub or Regular room, since neither has a config of its own.
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
