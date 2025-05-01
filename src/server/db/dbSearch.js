const envUtil = require("../util/envUtil.js");
const db = require("./db.js");
const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

const searchRoomsAssociatedWithUser = (userStatusesToInclude, page) => {
    const limit = globalConfig.search.searchLimitPerPage;
    const condsStr = ` AND (${userStatusesToInclude.map(x => `user_rooms.userStatus = '${x}'`).join(" OR ")})`;
    return `SELECT rooms.roomID AS roomID, rooms.roomName AS roomName, user_rooms.userStatus as userStatus, rooms.ownerUserName as ownerUserName
    FROM rooms INNER JOIN user_rooms ON user_rooms.roomID = rooms.roomID
    WHERE user_rooms.userID = ?${userStatusesToInclude.length > 0 ? condsStr : ""}
    ORDER BY rooms.roomID DESC LIMIT ${limit}, ${page * limit};`;
}

const searchUsersAssociatedWithRoom = (userStatusesToInclude, page) => {
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
        withRoomName: async (res, roomName) => {
            return await new db.query(`SELECT * FROM rooms WHERE roomName = ?;`, [roomName]).run(res);
        },
        whichIOwn: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser(["owner"], page), [userID]).run(res);
        },
        whichIJoined: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser(["member"], page), [userID]).run(res);
        },
        whichInvitedMe: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser(["invited"], page), [userID]).run(res);
        },
        whichIRequestedToJoin: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser(["requested"], page), [userID]).run(res);
        },
        whichIAmPendingToJoin: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser(["invited", "requested"], page), [userID]).run(res);
        },
        whichIAmAssociatedWith: async (res, userID, page) => {
            return await new db.query(searchRoomsAssociatedWithUser([], page), [userID]).run(res);
        },
        others: async (res, userID, page) => {
            const limit = globalConfig.search.searchLimitPerPage;
            return await new db.query(
                `SELECT roomID, roomName FROM rooms
                WHERE NOT EXISTS (SELECT roomID FROM user_rooms WHERE userID = ${userID} LIMIT 1)
                ORDER BY roomID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res);
        },
    },
    users: {
        withUserName: async (res, userName) => {
            return await new db.query(`SELECT * FROM users WHERE userName = ?;`, [userName]).run(res);
        },
        withEmail: async (res, email) => {
            return await new db.query(`SELECT * FROM users WHERE email = ?;`, [email]).run(res);
        },
        whoJoinedRoom: async (res, roomID, page) => {
            return await new db.query(searchUsersAssociatedWithRoom(["member"], page), [roomID]).run(res);
        },
        whoAreInvitedToJoinRoom: async (res, roomID, page) => {
            return await new db.query(searchUsersAssociatedWithRoom(["invited"], page), [roomID]).run(res);
        },
        whoRequestedToJoinRoom: async (res, roomID, page) => {
            return await new db.query(searchUsersAssociatedWithRoom(["requested"], page), [roomID]).run(res);
        },
        whoArePendingToJoinRoom: async (res, roomID, page) => {
            return await new db.query(searchUsersAssociatedWithRoom(["invited", "requested"], page), [roomID]).run(res);
        },
        whoAreAssociatedWithRoom: async (res, roomID, page) => {
            return await new db.query(searchUsersAssociatedWithRoom([], page), [roomID]).run(res);
        },
        others: async (res, roomID, page) => {
            return await new db.query(
                `SELECT userID, userName FROM users
                WHERE NOT EXISTS (SELECT userID FROM user_rooms WHERE roomID = ${roomID} LIMIT 1)
                ORDER BY userID DESC LIMIT ${limit}, ${page * limit};`,
                undefined
            ).run(res);
        },
    },
}

module.exports = dbSearch;