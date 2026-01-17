import DB from "./db";
import Room from "../../shared/room/types/room";
import dotenv from "dotenv";
import RoomGenerator from "../../shared/room/roomGenerator";
import SQLRoom from "../../shared/db/types/sqlRoom";
import { RoomType } from "../../shared/room/types/roomType";
dotenv.config();

const RoomDB =
{
    getRoomContent: async (roomID: number): Promise<Room | null> =>
    {
        const result = await DB.runQuery<SQLRoom>(
            `SELECT * FROM rooms WHERE rooms.roomID = ?;`,
            [roomID]);

        if (!result.success || result.data.length == 0)
            return null;
        return Room.fromSQL(result.data[0]);
    },
    saveRoomContent: async (room: Room): Promise<boolean> =>
    {
        const sqlRoom = room.toSQL();
        
        const result = await DB.runQuery<void>(
            `UPDATE rooms
            SET voxelGrid = ?, persistentObjectGroup = ?
            WHERE roomID = ?`,
            [Buffer.from(sqlRoom.voxelGrid), Buffer.from(sqlRoom.persistentObjectGroup),
                room.roomID]);

        return result.success;
    },
    createRoom: async (roomName: string, roomType: RoomType, ownerUserName: string,
        floorTextureIndex: number, wallTextureIndex: number, ceilingTextureIndex: number,
        texturePackURL: string): Promise<boolean> =>
    {
        const {voxelGrid, persistentObjectGroup} =
            RoomGenerator.generateEmptyRoom(floorTextureIndex, wallTextureIndex, ceilingTextureIndex);

        const room = new Room(0, roomName, roomType, ownerUserName, texturePackURL,
            voxelGrid, persistentObjectGroup);
        const sqlRoom = room.toSQL();

        const result = await DB.runQuery<void>(
            `INSERT INTO rooms
            (roomName, roomType, ownerUserName, texturePackURL, voxelGrid, persistentObjectGroup)
            VALUES (?, ?, ?, ?, ?, ?);`,
            [sqlRoom.roomName, sqlRoom.roomType, sqlRoom.ownerUserName, sqlRoom.texturePackURL,
                Buffer.from(sqlRoom.voxelGrid), Buffer.from(sqlRoom.persistentObjectGroup)]);

        return result.success;
    },
    deleteRoom: async (roomID: number): Promise<boolean> =>
    {
        const result = await DB.runQuery<void>(
            `DELETE FROM rooms WHERE roomID = ?;`,
            [roomID]);

        return result.success;
    },
}

export default RoomDB;