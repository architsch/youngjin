import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const searchRoomsAssociatedWithUser = (userStatusesToInclude: string[], page: number) => {
    const limit = 10;
    const condsStr = ` AND (${userStatusesToInclude.map(x => `roomMemberships.userStatus = '${x}'`).join(" OR ")})`;
    return `SELECT rooms.roomID AS roomID, rooms.roomName AS roomName, roomMemberships.userStatus as userStatus, rooms.ownerUserName as ownerUserName
    FROM rooms INNER JOIN roomMemberships ON roomMemberships.roomID = rooms.roomID
    WHERE roomMemberships.userID = ?${userStatusesToInclude.length > 0 ? condsStr : ""}
    ORDER BY rooms.roomID DESC LIMIT ${limit}, ${page * limit};`;
}

const searchUsersAssociatedWithRoom = (userStatusesToInclude: string[], page: number) => {
    const limit = 10;
    const condsStr = ` AND (${userStatusesToInclude.map(x => `roomMemberships.userStatus = '${x}'`).join(" OR ")})`;
    return `SELECT users.userID as userID, users.userName AS userName, roomMemberships.userStatus as userStatus
    FROM users INNER JOIN roomMemberships ON roomMemberships.userID = users.userID
    WHERE roomMemberships.roomID = ?${userStatusesToInclude.length > 0 ? condsStr : ""}
    ORDER BY users.userID DESC LIMIT ${limit}, ${page * limit};`;
}

const SearchDB =
{
    rooms: {
        withRoomName: async (roomName: string, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(`SELECT * FROM rooms WHERE roomName = ?;`, [roomName])
                .run(res, "SearchDB.rooms.withRoomName");
        },
        whichIOwn: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser(["owner"], page), [userID])
                .run(res, "SearchDB.rooms.whichIOwn");
        },
        whichIJoined: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser(["member"], page), [userID])
                .run(res, "SearchDB.rooms.whichIJoined");
        },
        whichInvitedMe: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser(["invited"], page), [userID])
                .run(res, "SearchDB.rooms.whichInvitedMe");
        },
        whichIRequestedToJoin: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser(["requested"], page), [userID])
                .run(res, "SearchDB.rooms.whichIRequestedToJoin");
        },
        whichIAmPendingToJoin: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser(["invited", "requested"], page), [userID])
                .run(res, "SearchDB.rooms.whichIAmPendingToJoin");
        },
        whichIAmAssociatedWith: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            return await DB.makeQuery<Room>(searchRoomsAssociatedWithUser([], page), [userID])
                .run(res, "SearchDB.rooms.whichIAmAssociatedWith");
        },
        others: async (userID: string, page: number, res?: Response): Promise<Room[]> => {
            const limit = 10;
            return await DB.makeQuery<Room>(
                `SELECT roomID, roomName FROM rooms
                WHERE NOT EXISTS (SELECT roomID FROM roomMemberships WHERE userID = ${userID} LIMIT 1)
                ORDER BY roomID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res, "SearchDB.rooms.others");
        },
    },
    users: {
        withUserName: async (userName: string, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(`SELECT * FROM users WHERE userName = ?;`, [userName])
                .run(res, "SearchDB.users.withUserName");
        },
        withEmail: async (email: string, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(`SELECT * FROM users WHERE email = ?;`, [email])
                .run(res, "SearchDB.users.withEmail");
        },
        whoJoinedRoom: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(searchUsersAssociatedWithRoom(["member"], page), [roomID])
                .run(res, "SearchDB.users.whoJoinedRoom");
        },
        whoAreInvitedToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(searchUsersAssociatedWithRoom(["invited"], page), [roomID])
                .run(res, "SearchDB.users.whoAreInvitedToJoinRoom");
        },
        whoRequestedToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(searchUsersAssociatedWithRoom(["requested"], page), [roomID])
                .run(res, "SearchDB.users.whoRequestedToJoinRoom");
        },
        whoArePendingToJoinRoom: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(searchUsersAssociatedWithRoom(["invited", "requested"], page), [roomID])
                .run(res, "SearchDB.users.whoArePendingToJoinRoom");
        },
        whoAreAssociatedWithRoom: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            return await DB.makeQuery<User>(searchUsersAssociatedWithRoom([], page), [roomID])
                .run(res, "SearchDB.users.whoAreAssociatedWithRoom");
        },
        others: async (roomID: string, page: number, res?: Response): Promise<User[]> => {
            const limit = 10;
            return await DB.makeQuery<User>(
                `SELECT userID, userName FROM users
                WHERE NOT EXISTS (SELECT userID FROM roomMemberships WHERE roomID = ${roomID} LIMIT 1)
                ORDER BY userID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res, "SearchDB.users.others");
        },
    },
}

export default SearchDB;