import db from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const dbRoom =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    getRoomContent: async (roomID: string, accessorUserID: string, res?: Response): Promise<room[]> =>
    {
        // TODO: Fetch the room's "saved data". (+ make sure to include the "ownerUserName" field in it.)
        return await db.makeQuery<room>(`SELECT rooms.*
            FROM rooms INNER JOIN user_rooms ON user_rooms.roomID = rooms.roomID
            WHERE rooms.roomID = ? AND user_rooms.userID = ? AND
                (user_rooms.userStatus = 'member' OR user_rooms.userStatus = 'owner');`,
            [roomID, accessorUserID]
        ).run(res);
    },
    createRoom: async (roomName: string, ownerUserName: string, res?: Response): Promise<void> =>
    {
        await db.makeTransaction([
            db.makeQuery(`INSERT INTO rooms (roomName, ownerUserName) VALUES (?, ?);`,
                [roomName, ownerUserName]),
            db.makeQuery(`INSERT INTO user_rooms (roomID, userID, userStatus)
                VALUES (LAST_INSERT_ID(), (SELECT userID FROM users WHERE userName = ?), 'owner');`,
                [ownerUserName]),
            db.makeQuery(`UPDATE users SET ownedRoomCount = ownedRoomCount + 1
                WHERE userName = ? AND ownedRoomCount < ownedRoomCountMax;`,
                [ownerUserName])
        ]).run(res);
    },
    deleteRoom: async (roomID: string, ownerUserName: string, res?: Response): Promise<void> =>
    {
        return await db.makeTransaction([
            db.makeQuery(`UPDATE users SET ownedRoomCount = ownedRoomCount - 1
                WHERE userID = ? AND ownedRoomCount > 0;`,
                [ownerUserName]),
            db.makeQuery(`DELETE FROM rooms WHERE roomID = ? AND ownerUserName = ?;`,
                [roomID, ownerUserName]),
            db.makeQuery(`DELETE FROM user_rooms WHERE roomID = ?;`,
                [roomID]),
        ]).run(res);
    },
    leaveRoom: async (roomID: string, leavingUserName: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'member';`,
            [roomID, leavingUserName]
        ).run(res);
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (roomID: string, inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`UPDATE user_rooms SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res);
    },
    ignoreInvitation: async (roomID: string, inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res);
    },
    requestToJoin: async (roomID: string, requesterUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`INSERT INTO user_rooms (roomID, userID, userStatus)
            VALUES (?, ?, 'requested');`,
            [roomID, requesterUserID]
        ).run(res);
    },
    cancelRequest: async (roomID: string, requesterUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested';`,
            [roomID, requesterUserID]
        ).run(res);
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (roomID: string, ownerUserName: string,
        inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`INSERT INTO user_rooms (roomID, userID, userStatus)
            VALUES (?, ?, 'invited')
            WHERE EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res);
    },
    cancelInvite: async (roomID: string, ownerUserName: string,
        inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res);
    },
    acceptRequest: async (roomID: string, ownerUserName: string,
        requesterUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`UPDATE user_rooms SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res);
    },
    ignoreRequest: async (roomID: string, ownerUserName: string,
        requesterUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res);
    },
    kickout: async (roomID: string, ownerUserName: string,
        targetUserID: string, res?: Response): Promise<void> =>
    {
        await db.makeQuery(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'member' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, targetUserID, roomID, ownerUserName]
        ).run(res);
    },
}

export default dbRoom;