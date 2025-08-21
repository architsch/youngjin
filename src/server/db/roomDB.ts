import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const RoomDB =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    getRoomContent: async (roomID: string, accessorUserID: string, res?: Response): Promise<Room[]> =>
    {
        // TODO: Fetch the room's "saved data". (+ make sure to include the "ownerUserName" field in it.)
        return await DB.makeQuery<Room>(`SELECT rooms.*
            FROM rooms INNER JOIN roomMemberships ON roomMemberships.roomID = rooms.roomID
            WHERE rooms.roomID = ? AND roomMemberships.userID = ? AND
                (roomMemberships.userStatus = 'member' OR roomMemberships.userStatus = 'owner');`,
            [roomID, accessorUserID]
        ).run(res, "RoomDB.getRoomContent");
    },
    createRoom: async (roomName: string, ownerUserName: string, res?: Response): Promise<void> =>
    {
        await DB.makeTransaction([
            DB.makeQuery(`INSERT INTO rooms (roomName, ownerUserName) VALUES (?, ?);`,
                [roomName, ownerUserName]),
            DB.makeQuery(`INSERT INTO roomMemberships (roomID, userID, userStatus)
                VALUES (LAST_INSERT_ID(), (SELECT userID FROM users WHERE userName = ?), 'owner');`,
                [ownerUserName]),
            DB.makeQuery(`UPDATE users SET ownedRoomCount = ownedRoomCount + 1
                WHERE userName = ? AND ownedRoomCount < ownedRoomCountMax;`,
                [ownerUserName])
        ]).run(res, "RoomDB.createRoom");
    },
    deleteRoom: async (roomID: string, ownerUserName: string, res?: Response): Promise<void> =>
    {
        return await DB.makeTransaction([
            DB.makeQuery(`UPDATE users SET ownedRoomCount = ownedRoomCount - 1
                WHERE userID = ? AND ownedRoomCount > 0;`,
                [ownerUserName]),
            DB.makeQuery(`DELETE FROM rooms WHERE roomID = ? AND ownerUserName = ?;`,
                [roomID, ownerUserName]),
            DB.makeQuery(`DELETE FROM roomMemberships WHERE roomID = ?;`,
                [roomID]),
        ]).run(res, "RoomDB.deleteRoom");
    },
    leaveRoom: async (roomID: string, leavingUserName: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'member';`,
            [roomID, leavingUserName]
        ).run(res, "RoomDB.leaveRoom");
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (roomID: string, inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`UPDATE roomMemberships SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res, "RoomDB.acceptInvitation");
    },
    ignoreInvitation: async (roomID: string, inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res, "RoomDB.ignoreInvitation");
    },
    requestToJoin: async (roomID: string, requesterUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`INSERT INTO roomMemberships (roomID, userID, userStatus)
            VALUES (?, ?, 'requested');`,
            [roomID, requesterUserID]
        ).run(res, "RoomDB.requestToJoin");
    },
    cancelRequest: async (roomID: string, requesterUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested';`,
            [roomID, requesterUserID]
        ).run(res, "RoomDB.cancelRequest");
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (roomID: string, ownerUserName: string,
        inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`INSERT INTO roomMemberships (roomID, userID, userStatus)
            VALUES (?, ?, 'invited')
            WHERE EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res, "RoomDB.invite");
    },
    cancelInvite: async (roomID: string, ownerUserName: string,
        inviteeUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res, "RoomDB.cancelInvite");
    },
    acceptRequest: async (roomID: string, ownerUserName: string,
        requesterUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`UPDATE roomMemberships SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res, "RoomDB.acceptRequest");
    },
    ignoreRequest: async (roomID: string, ownerUserName: string,
        requesterUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res, "RoomDB.ignoreRequest");
    },
    kickout: async (roomID: string, ownerUserName: string,
        targetUserID: string, res?: Response): Promise<void> =>
    {
        await DB.makeQuery(`DELETE FROM roomMemberships
            WHERE roomID = ? AND userID = ? AND userStatus = 'member' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, targetUserID, roomID, ownerUserName]
        ).run(res, "RoomDB.kickout");
    },
}

export default RoomDB;