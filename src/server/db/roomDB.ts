import DB from "./db";
import Room from "../../shared/room/types/room";
import { Response } from "express";
import dotenv from "dotenv";
import RoomGenerator from "../../shared/room/roomGenerator";
import Encoding from "../../shared/networking/encoding";
import SerializedRoom from "../../shared/room/types/serializedRoom";
import VoxelGrid from "../../shared/voxel/types/voxelGrid";
import BufferState from "../../shared/networking/types/bufferState";
import PersistentObjectGroup from "../../shared/object/types/persistentObjectGroup";
dotenv.config();

const RoomDB =
{
    getRoom: async (roomID: number, res?: Response): Promise<Room | null> =>
    {
        const result = await DB.runQuery<SerializedRoom>(
            `SELECT * FROM rooms WHERE rooms.roomID = ?;`,
            [roomID], res, "RoomDB.getRoom");

        if (!result.success || result.data.length == 0)
            return null;
        const serializedRoom = result.data[0];

        const voxelGrid = VoxelGrid.decode(
            new BufferState(new Uint8Array(serializedRoom.voxelGrid))
        ) as VoxelGrid;

        const persistentObjectGroup = PersistentObjectGroup.decode(
            new BufferState(new Uint8Array(serializedRoom.persistentObjectGroup))
        ) as PersistentObjectGroup;
        
        return new Room(
            serializedRoom.roomID, serializedRoom.roomName, serializedRoom.ownerUserName,
            serializedRoom.texturePackURL, voxelGrid, persistentObjectGroup);
    },
    saveRoomContent: async (room: Room, res?: Response): Promise<boolean> =>
    {
        const {voxelGridBuffer, persistentObjectGroupBuffer} =
            encodeRoomContent(room.voxelGrid, room.persistentObjectGroup);
        
        const result = await DB.runQuery<void>(
            `UPDATE rooms
            SET voxelGrid = ?, persistentObjectGroup = ?
            WHERE roomID = ?`,
            [voxelGridBuffer, persistentObjectGroupBuffer, room.roomID],
            res, "RoomDB.saveRoomContent");

        return result.success;
    },
    createRoom: async (roomName: string, ownerUserName: string,
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number,
        texturePackURL: string,
        res?: Response): Promise<boolean> =>
    {
        const {voxelGrid, persistentObjectGroup} =
            RoomGenerator.generateEmptyRoom(floorTextureIndex, wallTextureIndex, ceilingTextureIndex);

        const {voxelGridBuffer, persistentObjectGroupBuffer} =
            encodeRoomContent(voxelGrid, persistentObjectGroup);

        const result = await DB.runQuery<void>(
            `INSERT INTO rooms
            (roomName, ownerUserName, texturePackURL, voxelGrid, persistentObjectGroup)
            VALUES (?, ?, ?, ?, ?);`,
            [roomName, ownerUserName, texturePackURL, voxelGridBuffer, persistentObjectGroupBuffer],
            res, "RoomDB.createRoom");

        return result.success;
    },
    deleteRoom: async (roomID: number, res?: Response): Promise<boolean> =>
    {
        const result = await DB.runQuery<void>(
            `DELETE FROM rooms WHERE roomID = ?;`,
            [roomID], res, "RoomDB.deleteRoom");

        return result.success;
    },
}

function encodeRoomContent(voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup)
    : {voxelGridBuffer: Buffer<ArrayBuffer>, persistentObjectGroupBuffer: Buffer<ArrayBuffer>}
{
    let bufferState = Encoding.startWrite();
    voxelGrid.encode(bufferState);
    const voxelGridBuffer = Buffer.from(Encoding.endWrite(bufferState));

    bufferState = Encoding.startWrite(bufferState.byteIndex);
    persistentObjectGroup.encode(bufferState);
    const persistentObjectGroupBuffer = Buffer.from(Encoding.endWrite(bufferState));

    return {voxelGridBuffer, persistentObjectGroupBuffer};
}

export default RoomDB;