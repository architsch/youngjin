import db from "./db";
import { Response } from "express";
import globalConfig from "../config/globalConfig";
import dotenv from "dotenv";
dotenv.config();

const searchRoomsAssociatedWithUser = (userStatusesToInclude: string[], page: number) => {
    const limit = globalConfig.search.searchLimitPerPage;
    const condsStr = ` AND (${userStatusesToInclude.map(x => `user_rooms.userStatus = '${x}'`).join(" OR ")})`;
    return `SELECT rooms.roomID AS roomID, rooms.roomName AS roomName, user_rooms.userStatus as userStatus, rooms.ownerUserName as ownerUserName
    FROM rooms INNER JOIN user_rooms ON user_rooms.roomID = rooms.roomID
    WHERE user_rooms.userID = ?${userStatusesToInclude.length > 0 ? condsStr : ""}
    ORDER BY rooms.roomID DESC LIMIT ${limit}, ${page * limit};`;
}

const searchUsersAssociatedWithRoom = (userStatusesToInclude: string[], page: number) => {
    const limit = globalConfig.search.searchLimitPerPage;
    const condsStr = ` AND (${userStatusesToInclude.map(x => `user_rooms.userStatus = '${x}'`).join(" OR ")})`;
    return `SELECT users.userID as userID, users.userName AS userName, user_rooms.userStatus as userStatus
    FROM users INNER JOIN user_rooms ON user_rooms.userID = users.userID
    WHERE user_rooms.roomID = ?${userStatusesToInclude.length > 0 ? condsStr : ""}
    ORDER BY users.userID DESC LIMIT ${limit}, ${page * limit};`;
}

const dbSearch =
{
    rooms: {
        withRoomName: async (roomName: string, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(`SELECT * FROM rooms WHERE roomName = ?;`, [roomName]).run(res);
        },
        whichIOwn: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser(["owner"], page), [userID]).run(res);
        },
        whichIJoined: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser(["member"], page), [userID]).run(res);
        },
        whichInvitedMe: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser(["invited"], page), [userID]).run(res);
        },
        whichIRequestedToJoin: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser(["requested"], page), [userID]).run(res);
        },
        whichIAmPendingToJoin: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser(["invited", "requested"], page), [userID]).run(res);
        },
        whichIAmAssociatedWith: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            return await db.makeQuery<room>(searchRoomsAssociatedWithUser([], page), [userID]).run(res);
        },
        others: async (userID: string, page: number, res?: Response): Promise<room[]> => {
            const limit = globalConfig.search.searchLimitPerPage;
            return await db.makeQuery<room>(
                `SELECT roomID, roomName FROM rooms
                WHERE NOT EXISTS (SELECT roomID FROM user_rooms WHERE userID = ${userID} LIMIT 1)
                ORDER BY roomID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res);
        },
    },
    users: {
        withUserName: async (userName: string, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(`SELECT * FROM users WHERE userName = ?;`, [userName]).run(res);
        },
        withEmail: async (email: string, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(`SELECT * FROM users WHERE email = ?;`, [email]).run(res);
        },
        whoJoinedRoom: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(searchUsersAssociatedWithRoom(["member"], page), [roomID]).run(res);
        },
        whoAreInvitedToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(searchUsersAssociatedWithRoom(["invited"], page), [roomID]).run(res);
        },
        whoRequestedToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(searchUsersAssociatedWithRoom(["requested"], page), [roomID]).run(res);
        },
        whoArePendingToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(searchUsersAssociatedWithRoom(["invited", "requested"], page), [roomID]).run(res);
        },
        whoAreAssociatedWithRoom: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            return await db.makeQuery<user>(searchUsersAssociatedWithRoom([], page), [roomID]).run(res);
        },
        others: async (roomID: string, page: number, res?: Response): Promise<user[]> => {
            const limit = globalConfig.search.searchLimitPerPage;
            return await db.makeQuery<user>(
                `SELECT userID, userName FROM users
                WHERE NOT EXISTS (SELECT userID FROM user_rooms WHERE roomID = ${roomID} LIMIT 1)
                ORDER BY userID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res);
        },
    },
}

export default dbSearch;