import Room from "../../../shared/room/types/room";
import dotenv from "dotenv";
import RoomGenerator from "../../../shared/room/roomGenerator";
import DBRoom from "../types/row/dbRoom";
import { RoomType } from "../../../shared/room/types/roomType";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import VoxelGrid from "../../../shared/voxel/types/voxelGrid";
import BufferState from "../../../shared/networking/types/bufferState";
import PersistentObjectGroup from "../../../shared/object/types/persistentObjectGroup";
import DBRoomVersionMigration from "../types/versionMigration/dbRoomVersionMigration";
import DBFileStorageUtil from "./dbFileStorageUtil";
dotenv.config();

const DBRoomUtil =
{
    getRoomContent: async (roomID: string): Promise<Room | null> =>
    {
        const result = await new DBQuery<DBRoom>()
            .select()
            .from("rooms")
            .where("id", "==", roomID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return await getRoomFromDBRoom(result.data[0]);
    },
    saveRoomContent: async (room: Room): Promise<boolean> =>
    {
        const bufferState = EncodingUtil.startEncoding();
        room.voxelGrid.encode(bufferState);
        room.persistentObjectGroup.encode(bufferState);
        const buffer = Buffer.from(EncodingUtil.endEncoding(bufferState));
        return await DBFileStorageUtil.saveBinaryFile(getRoomContentFilePath(room.id), buffer);
    },
    deleteRoomContent: async (room: Room): Promise<boolean> =>
    {
        return await DBFileStorageUtil.deleteFile(getRoomContentFilePath(room.id));
    },
    createRoom: async (roomName: string, roomType: RoomType, ownerUserName: string,
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number,
        texturePackPath: string): Promise<boolean> =>
    {
        const {voxelGrid, persistentObjectGroup} =
            RoomGenerator.generateEmptyRoom(floorTextureIndex, wallTextureIndex, ceilingTextureIndex);

        const room = new Room(undefined, roomName, roomType, ownerUserName, texturePackPath,
            voxelGrid, persistentObjectGroup);
        const dbRoom = getDBRoomFromRoom(room);

        const contentSaved = await DBRoomUtil.saveRoomContent(room);
        if (!contentSaved)
            return false;

        const roomInsertResult = await new DBQuery<DBRow>()
            .insertInto("rooms")
            .values(dbRoom as DBRow)
            .run();
        
        if (!roomInsertResult.success)
        {
            await DBRoomUtil.deleteRoomContent(room);
            return false;
        }
        else
            return true;
    },
    deleteRoom: async (id: string): Promise<boolean> =>
    {
        const result = await new DBQuery<DBRow>()
            .delete()
            .from("rooms")
            .where("id", "==", id)
            .run();
        return result.success;
    },
    changeRoomName: async (room: Room, newRoomName: string): Promise<boolean> =>
    {
        const result = await new DBQuery<DBRow>()
            .update("rooms")
            .set({
                roomName: newRoomName,
            })
            .where("id", "==", room.id)
            .run();
        return result.success;
    },
}

function getDBRoomFromRoom(room: Room): DBRoom
{
    const dbRoom: DBRoom = {
        id: room.id,
        version: DBRoomVersionMigration.length,
        roomName: room.roomName,
        roomType: room.roomType,
        ownerUserName: room.ownerUserName,
        texturePackPath: room.texturePackPath,
    };
    return dbRoom;
}

async function getRoomFromDBRoom(dbRoom: DBRoom): Promise<Room | null>
{
    const buffer = await DBFileStorageUtil.loadBinaryFile(getRoomContentFilePath(dbRoom.id));
    if (!buffer)
        return null;

    const bufferState = new BufferState(new Uint8Array(buffer));
    const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
    const persistentObjectGroup = PersistentObjectGroup.decode(bufferState) as PersistentObjectGroup;

    return new Room(
        dbRoom.id,
        dbRoom.roomName,
        dbRoom.roomType,
        dbRoom.ownerUserName,
        dbRoom.texturePackPath,
        voxelGrid,
        persistentObjectGroup
    );
}

function getRoomContentFilePath(roomID?: string): string
{
    if (!roomID)
        throw new Error("getRoomContentFilePath :: roomID not found.");
    return `rooms/${roomID}/content.bin`;
}

export default DBRoomUtil;