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
import { COLLISION_LAYER_MIN, MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../../system/sharedConstants";

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
                new HubRoomBuilder(makeMultiplayerRoomBuilderParams(seed), room).run();
                break;
            case RoomTypeEnumMap.Regular:
                new RegularRoomBuilder(makeMultiplayerRoomBuilderParams(seed), room).run();
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

// What a procedurally generated multiplayer room is built from. Its entrance is the one fixed cell
// every multiplayer room shares, and everything else about the room is drawn rather than declared —
// the texture pack included, which the builder writes back over texturePackPath once it has picked
// one.
function makeMultiplayerRoomBuilderParams(seed?: number): RoomBuilderParams
{
    return {
        entranceVoxelCol: MULTI_PLAYER_ENTRANCE_VOXEL_COL,
        entranceVoxelRow: MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
        entranceVoxelCollisionLayer: COLLISION_LAYER_MIN,
        texturePackPath: "",
        hotspots: {},
        volumes: {},
        rand: new RandomNumberGenerator(seed),
    };
}

export default RoomGenerationUtil;
