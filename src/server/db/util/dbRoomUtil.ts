import Room from "../../../shared/room/types/room";
import RoomGenerator from "../../../shared/room/roomGenerator";
import DBRoom from "../types/row/dbRoom";
import { RoomType } from "../../../shared/room/types/roomType";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import VoxelGrid from "../../../shared/voxel/types/voxelGrid";
import BufferState from "../../../shared/networking/types/bufferState";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import DBRoomVersionMigration from "../types/versionMigration/dbRoomVersionMigration";
import DBFileStorageUtil from "./dbFileStorageUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { COLLECTION_ROOMS } from "../../system/serverConstants";

const DBRoomUtil =
{
    getRoomContent: async (roomID: string): Promise<Room | null> =>
    {
        LogUtil.log("DBRoomUtil.getRoomContent", {roomID}, "low", "info");
        const result = await new DBQuery<DBRoom>()
            .select()
            .from(COLLECTION_ROOMS)
            .where("id", "==", roomID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return await getRoomFromDBRoom(result.data[0]);
    },
    saveRoomContent: async (room: Room): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.saveRoomContent", {roomID: room.id}, "low", "info");
        const bufferState = EncodingUtil.startEncoding();
        room.voxelGrid.encode(bufferState);

        // Encode only persistent objects
        const persistentObjects = Object.values(room.objectById)
            .filter(obj => ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).persistent);
        new EncodableArray(persistentObjects, 65535).encode(bufferState);

        const buffer = Buffer.from(EncodingUtil.endEncoding(bufferState));
        return await DBFileStorageUtil.saveBinaryFile(getRoomContentFilePath(room.id), buffer);
    },
    deleteRoomContent: async (room: Room): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.deleteRoomContent", {roomID: room.id}, "low", "info");
        return await DBFileStorageUtil.deleteFile(getRoomContentFilePath(room.id));
    },
    createRoom: async (roomType: RoomType, ownerUserID: string,
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number,
        texturePackPath: string): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBRoomUtil.createRoom", {roomType, ownerUserID, floorTextureIndex, wallTextureIndex,
            ceilingTextureIndex, texturePackPath}, "low", "info");
        const {voxelGrid} =
            RoomGenerator.generateEmptyRoom(floorTextureIndex, wallTextureIndex, ceilingTextureIndex);

        const room = new Room(undefined, roomType, ownerUserID, texturePackPath,
            voxelGrid);
        const dbRoom = getDBRoomFromRoom(room);

        const roomInsertResult = await new DBQuery<{id: string}>()
            .insertInto(COLLECTION_ROOMS)
            .values(dbRoom as DBRow)
            .run();

        if (!roomInsertResult.success)
        {
            await DBRoomUtil.deleteRoomContent(room);
            return {success: false, data: []};
        }
        room.id = roomInsertResult.data[0].id;

        const contentSaved = await DBRoomUtil.saveRoomContent(room);
        if (!contentSaved)
            return {success: false, data: []};

        return roomInsertResult;
    },
    deleteRoom: async (roomID: string): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.deleteRoom", {roomID}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .delete()
            .from(COLLECTION_ROOMS)
            .where("id", "==", roomID)
            .run();
        return result.success;
    },
    changeRoomTexturePackPath: async (room: Room, newTexturePackPath: string): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.changeRoomTexturePackPath", {roomID: room.id, newTexturePackPath}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_ROOMS)
            .set({
                texturePackPath: newTexturePackPath,
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
        roomType: room.roomType,
        ownerUserID: room.ownerUserID,
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

    const objectArray = EncodableArray.decodeWithParams(bufferState, AddObjectSignal.decode, 65535) as EncodableArray;
    const objectById: {[objectId: string]: AddObjectSignal} = {};
    for (const element of objectArray.arr)
    {
        const obj = element as AddObjectSignal;
        objectById[obj.objectId] = obj;
    }

    return new Room(
        dbRoom.id,
        dbRoom.roomType,
        dbRoom.ownerUserID,
        dbRoom.texturePackPath,
        voxelGrid,
        objectById
    );
}

function getRoomContentFilePath(roomID?: string): string
{
    if (!roomID)
        throw new Error("getRoomContentFilePath :: roomID not found.");
    return `${COLLECTION_ROOMS}/${roomID}/content.bin`;
}

export default DBRoomUtil;
