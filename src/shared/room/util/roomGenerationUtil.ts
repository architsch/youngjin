import SinglePlayerModeConfigMap from "../../singlePlayer/maps/singlePlayerModeConfigMap";
import ObjectGroup from "../../object/types/objectGroup";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../voxel/types/voxelQuadsRuntimeMemory";
import Room from "../types/room";
import { RoomType, RoomTypeEnumMap } from "../types/roomType";
import ProceduralRoomGenerationUtil from "./proceduralRoomGenerationUtil";

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
    generateRoomContent: (room: Room): void =>
    {
        room.voxelGrid = VoxelGrid.createEmpty();
        room.objectGroup = new ObjectGroup([]);

        switch (room.roomType)
        {
            case RoomTypeEnumMap.Hub:
            case RoomTypeEnumMap.Regular:
                // Every multiplayer room is laid out procedurally, from a seed drawn when it is
                // created, so that no two rooms open on the same interior. The seed is not kept:
                // the room it produced is saved as ordinary content, and is edited from then on
                // like any other room's.
                ProceduralRoomGenerationUtil.generateMultiplayerRoom(room,
                    Math.floor(Math.random() * 0x7FFFFFFF));
                return;
            case RoomTypeEnumMap.SinglePlayer:
                generateSinglePlayerRoom(room);
                return;
            default: throw new Error(`Unknown room type :: ${room.roomType}`);
        }
    },
    // A brand new room of the given type, generated and ready to be stored. Its ID stays empty
    // until the DB assigns one.
    generateRoom: (roomName: string, roomType: RoomType,
        ownerUserID: string = "", ownerUserName: string = ""): Room =>
    {
        const room = new Room(undefined, roomName, roomType, ownerUserID, ownerUserName,
            "", new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));
        RoomGenerationUtil.generateRoomContent(room);
        return room;
    },
}

function generateSinglePlayerRoom(room: Room): void
{
    // (roomName == singlePlayerMode) if the room is a singleplayer room.
    const config = SinglePlayerModeConfigMap[room.roomName];
    room.texturePackPath = config.texturePackPath;
    config.buildRoom(room.voxelGrid, room.objectGroup);
}

export default RoomGenerationUtil;
