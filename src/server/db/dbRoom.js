const envUtil = require("../util/envUtil.js");
const db = require("./db.js");
require("dotenv").config();

const dbRoom =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    getRoomContent: async (res, roomID, accessorUserID) => {
        // TODO: Fetch the room's "saved data". (+ make sure to include the "ownerUserName" field in it.)
        return await new db.query(`SELECT rooms.*
            FROM rooms INNER JOIN user_rooms ON user_rooms.roomID = rooms.roomID
            WHERE rooms.roomID = ? AND user_rooms.userID = ? AND
                (user_rooms.userStatus = 'member' OR user_rooms.userStatus = 'owner');`,
            [roomID, accessorUserID]
        ).run(res);
    },
    createRoom: async (res, roomName, ownerUserName) => {
        return await new db.transaction([
            new db.query(`INSERT INTO rooms (roomName, ownerUserName) VALUES (?, ?);`,
                [roomName, ownerUserName]),
            new db.query(`INSERT INTO user_rooms (roomID, userID, userStatus)
                VALUES (LAST_INSERT_ID(), (SELECT userID FROM users WHERE userName = ?), 'owner');`,
                [ownerUserName]),
            new db.query(`UPDATE users SET ownedRoomCount = ownedRoomCount + 1
                WHERE userName = ? AND ownedRoomCount < ownedRoomCountMax;`,
                [ownerUserName])
        ]).run(res);
    },
    deleteRoom: async (res, roomID, ownerUserName) => {
        return await new db.transaction([
            new db.query(`UPDATE users SET ownedRoomCount = ownedRoomCount - 1
                WHERE userID = ? AND ownedRoomCount > 0;`,
                [ownerUserName]),
            new db.query(`DELETE FROM rooms WHERE roomID = ? AND ownerUserName = ?;`,
                [roomID, ownerUserName]),
            new db.query(`DELETE FROM user_rooms WHERE roomID = ?;`,
                [roomID]),
        ]).run(res);
    },
    leaveRoom: async (res, roomID, leavingUserName) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'member';`,
            [roomID, leavingUserName]
        ).run(res);
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (res, roomID, inviteeUserID) => {
        return await new db.query(`UPDATE user_rooms SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res);
    },
    ignoreInvitation: async (res, roomID, inviteeUserID) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited';`,
            [roomID, inviteeUserID]
        ).run(res);
    },
    requestToJoin: async (res, roomID, requesterUserID) => {
        return await new db.query(`INSERT INTO user_rooms (roomID, userID, userStatus)
            VALUES (?, ?, 'requested');`,
            [roomID, requesterUserID]
        ).run(res);
    },
    cancelRequest: async (res, roomID, requesterUserID) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested';`,
            [roomID, requesterUserID]
        ).run(res);
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (res, roomID, ownerUserName, inviteeUserID) => {
        return await new db.query(`INSERT INTO user_rooms (roomID, userID, userStatus)
            VALUES (?, ?, 'invited')
            WHERE EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res);
    },
    cancelInvite: async (res, roomID, ownerUserName, inviteeUserID) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'invited' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, inviteeUserID, roomID, ownerUserName]
        ).run(res);
    },
    acceptRequest: async (res, roomID, ownerUserName, requesterUserID) => {
        return await new db.query(`UPDATE user_rooms SET userStatus = 'member'
            WHERE roomID = ? AND userID = ? userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res);
    },
    ignoreRequest: async (res, roomID, ownerUserName, requesterUserID) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'requested' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, requesterUserID, roomID, ownerUserName]
        ).run(res);
    },
    kickout: async (res, roomID, ownerUserName, targetUserID) => {
        return await new db.query(`DELETE FROM user_rooms
            WHERE roomID = ? AND userID = ? AND userStatus = 'member' AND EXISTS (
                SELECT roomID FROM rooms WHERE roomID = ? AND ownerUserName = ? LIMIT 1
            );`,
            [roomID, targetUserID, roomID, ownerUserName]
        ).run(res);
    },
}

module.exports = dbRoom;