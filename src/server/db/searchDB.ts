import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
import User from "../../shared/auth/types/user";
dotenv.config();

const SearchDB =
{
    rooms: {
        all: async (page: number, res?: Response): Promise<RoomSearchResult[]> => {
            const result = await DB.runQuery<RoomSearchResult>(
                `SELECT roomID, roomName FROM rooms
                ORDER BY roomID LIMIT 10, ${page * 10};`,
                undefined, res, "SearchDB.rooms.all");
            return result.data;
        },
        withRoomName: async (roomName: string, res?: Response): Promise<RoomSearchResult[]> => {
            const result = await DB.runQuery<RoomSearchResult>(
                `SELECT roomID, roomName FROM rooms WHERE roomName = ?;`,
                [roomName], res, "SearchDB.rooms.withRoomName");
            return result.data;
        },
    },
    users: {
        all: async (page: number, res?: Response): Promise<User[]> => {
            const result = await DB.runQuery<User>(
                `SELECT * FROM users
                ORDER BY userID LIMIT 10, ${page * 10};`,
                undefined, res, "SearchDB.users.all");
            return result.data;
        },
        withUserName: async (userName: string, res?: Response): Promise<User[]> => {
            const result = await DB.runQuery<User>(
                `SELECT * FROM users WHERE userName = ?;`,
                [userName], res, "SearchDB.users.withUserName");
            return result.data;
        },
    },
}

export interface RoomSearchResult
{
    roomID: string;
    roomName: string;
}

export default SearchDB;