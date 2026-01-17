import DB from "./db";
import dotenv from "dotenv";
import SQLQueryResponse from "./types/sqlQueryResponse";
import { RoomType } from "../../shared/room/types/roomType";
import SQLUser from "../../shared/db/types/sqlUser";
dotenv.config();

const SearchDB =
{
    rooms: {
        all: async (page: number): Promise<SQLQueryResponse<RoomSearchResult>> => {
            return await DB.runQuery<RoomSearchResult>(
                `SELECT roomID, roomName, roomType FROM rooms
                ORDER BY roomID LIMIT 10, ${page * 10};`);
        },
        withRoomName: async (roomName: string): Promise<SQLQueryResponse<RoomSearchResult>> => {
            return await DB.runQuery<RoomSearchResult>(
                `SELECT roomID, roomName, roomType FROM rooms WHERE roomName = ?;`,
                [roomName]);
        },
        withRoomType: async (roomType: RoomType): Promise<SQLQueryResponse<RoomSearchResult>> => {
            return await DB.runQuery<RoomSearchResult>(
                `SELECT roomID, roomName, roomType FROM rooms WHERE roomType = ?;`,
                [roomType]);
        },
    },
    users: {
        all: async (page: number): Promise<SQLQueryResponse<SQLUser>> => {
            return await DB.runQuery<SQLUser>(
                `SELECT * FROM users
                ORDER BY userID LIMIT 10, ${page * 10};`);
        },
        withUserName: async (userName: string): Promise<SQLQueryResponse<SQLUser>> => {
            return await DB.runQuery<SQLUser>(
                `SELECT * FROM users WHERE userName = ?;`,
                [userName]);
        },
        withUserNameOrEmail: async (userName: string, email: string): Promise<SQLQueryResponse<SQLUser>> => {
            return await DB.runQuery<SQLUser>(
                `SELECT * FROM users WHERE userName = ? OR email = ?;`,
                [userName, email]);
        },
    },
}

export interface RoomSearchResult
{
    roomID: number;
    roomName: string;
    roomType: RoomType,
}

export default SearchDB;