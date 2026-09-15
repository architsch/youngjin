import Room from "../../../shared/room/types/room";
import RoomGenerationUtil from "../../../shared/room/generation/util/roomGenerationUtil";
import DBRoom from "../types/row/dbRoom";
import { RoomType } from "../../../shared/room/types/roomType";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import VoxelGrid from "../../../shared/voxel/types/voxelGrid";
import BufferState from "../../../shared/networking/types/bufferState";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import DBRoomVersionMigration from "../types/versionMigration/dbRoomVersionMigration";
import DBFileStorageUtil from "./dbFileStorageUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { COLLECTION_ROOMS } from "../../system/serverConstants";
import ObjectGroup from "../../../shared/object/types/objectGroup";

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
    // The DB row only, without loading the content blob.
    getDBRoom: async (roomID: string): Promise<DBRoom | null> =>
    {
        LogUtil.log("DBRoomUtil.getDBRoom", {roomID}, "low", "info");
        const result = await new DBQuery<DBRoom>()
            .select()
            .from(COLLECTION_ROOMS)
            .where("id", "==", roomID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return result.data[0];
    },
    saveRoomContent: async (room: Room, forceSaveNonPersistentObjects: boolean = false): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.saveRoomContent", {roomID: room.id}, "low", "info");
        const bufferState = EncodingUtil.startEncoding();
        room.voxelGrid.encode(bufferState);

        // Only persistent objects are saved, except on the first save after generation (all generated
        // objects are intrinsic content).
        const persistentObjects = forceSaveNonPersistentObjects
            ? Object.values(room.objectById)
            : Object.values(room.objectById)
                .filter(obj => ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).persistent);
        new ObjectGroup(persistentObjects).encode(bufferState);

        const buffer = Buffer.from(EncodingUtil.endEncoding(bufferState));
        return await DBFileStorageUtil.saveBinaryFile(getRoomContentFilePath(room.id), buffer);
    },
    deleteRoomContent: async (room: Room): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.deleteRoomContent", {roomID: room.id}, "low", "info");
        return await DBFileStorageUtil.deleteFile(getRoomContentFilePath(room.id));
    },
    createRoom: async (roomName: string, roomType: RoomType,
        ownerUserID: string, ownerUserName: string): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBRoomUtil.createRoom", {roomType, ownerUserID, ownerUserName}, "low", "info");

        // Generation decides all initial state, including room-level parameters (see RoomGenerationUtil).
        const room = RoomGenerationUtil.generateRoom(roomName, roomType, ownerUserID, ownerUserName);

        // No "id" field (see DBRowIdentityUtil).
        const dbRoom: Omit<DBRoom, "id"> = {
            version: DBRoomVersionMigration.length,
            roomName: room.roomName,
            roomType: room.roomType,
            ownerUserID: room.ownerUserID,
            ownerUserName: room.ownerUserName,
            texturePackPath: room.texturePackPath,
            prefs: room.prefs,
        };

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

        const contentSaved = await DBRoomUtil.saveRoomContent(room, true);
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
    changeRoomPrefs: async (room: Room, newPrefs: string): Promise<boolean> =>
    {
        LogUtil.log("DBRoomUtil.changeRoomPrefs", {roomID: room.id, newPrefs}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_ROOMS)
            .set({
                prefs: newPrefs,
            })
            .where("id", "==", room.id)
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

async function getRoomFromDBRoom(dbRoom: DBRoom): Promise<Room | null>
{
    const buffer = await DBFileStorageUtil.loadBinaryFile(getRoomContentFilePath(dbRoom.id));
    if (!buffer)
        return null;

    const bufferState = new BufferState(new Uint8Array(buffer));
    const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
    // The grid's version dates the objects stored with it (see ObjectGroupVersionMigration).
    const objectGroup = ObjectGroup.decodeWithParams(bufferState, dbRoom.id ?? "",
        voxelGrid.sourceFormatVersion) as ObjectGroup;
    const room = new Room(dbRoom.id, dbRoom.roomName, dbRoom.roomType,
        dbRoom.ownerUserID, dbRoom.ownerUserName, dbRoom.texturePackPath, dbRoom.prefs,
        voxelGrid, objectGroup);

    // Rooms converted from an older format are marked dirty, so the conversion is saved once.
    if (voxelGrid.sourceFormatVersion < VoxelGrid.latestFormatVersion
        || objectGroup.sourceFormatVersion < ObjectGroup.latestFormatVersion)
        room.dirty = true;

    return room;
}

function getRoomContentFilePath(roomID?: string): string
{
    if (!roomID)
        throw new Error("getRoomContentFilePath :: roomID not found.");
    return `${COLLECTION_ROOMS}/${roomID}/content.bin`;
}

export default DBRoomUtil;
