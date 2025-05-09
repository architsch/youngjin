const debugUtil = require("../server/util/debugUtil");

const textUtil = require("../shared/util/textUtil.mjs").textUtil;

let users = {};
let rooms = {};
let user_rooms = {};
let emailVerifications = {};

const isRoomOwner = (room, user) => room.roomOwnerName = user.userName;

const testDB =
{
    _reset: () =>
    {
        users = {}; // user = {userName, password, email}
        rooms = {}; // room = {roomName, roomOwnerName}
        user_rooms = {}; // user_room = {roomName, userName, userStatus}
        emailVerifications = {}; // emailVerification = {email, verificationCode, expirationTime}
    },
    toString: () =>
    {
        return JSON.stringify({users, rooms, user_rooms}, null, 4);
    },
    toHTMLString: () => {
        const section = (text) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj) => textUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(users) +
            section("rooms") + toSafeStr(rooms) +
            section("user_rooms") + toSafeStr(user_rooms) +
            section("emailVerifications") + toSafeStr(emailVerifications);
        return content;
    },
    insertUser: (user) =>
    {
        if (users[user.userName] == undefined) // user doesn't exist yet
        {
            users[user.userName] = user;
            return true;
        }
        return false;
    },
    deleteUser: (user) =>
    {
        if (users[user.userName] != undefined) // user exists
        {
            delete users[user.userName];
            return true;
        }
        return false;
    },
    insertEmailVerification: (emailVerification) =>
    {
        if (emailVerifications[emailVerification.email] == undefined) // emailVerification doesn't exist yet
        {
            emailVerifications[emailVerification.email] = emailVerification;
            return true;
        }
        return false;
    },
    deleteEmailVerification: (emailVerification) =>
    {
        if (emailVerifications[emailVerification.email] != undefined) // emailVerification exists
        {
            delete emailVerifications[emailVerification.email];
            return true;
        }
        return false;
    },
    insertRoom: (room, roomOwner) =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] == undefined) // room doesn't exist yet
        {
            room.roomOwnerName = roomOwner.userName;
            rooms[room.roomName] = room;
            if (!testDB.insertUserRoom({roomName: room.roomName, userName: roomOwner.userName, userStatus: "owner"}, roomOwner))
            {
                debugUtil.log(`Error: insertRoom succeeded but insertUserRoom failed.`, {room, roomOwner}, "high");
                room.roomOwnerName = null; // revert change
                delete rooms[room.roomName]; // revert change
                return false;
            }
            return true;
        }
        return false;
    },
    deleteRoom: (room, roomOwner) =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] != undefined && // room exists
            isRoomOwner(room, roomOwner)) // owner is correct
        {
            room.roomOwnerName = null;
            delete rooms[room.roomName];
            user_rooms
                .filter(x => x.roomName == room.roomName)
                .map(x => `${x.roomName} :: ${x.userName}`)
                .forEach(key => delete user_rooms[key]);
            return true;
        }
        return false;
    },
    insertUserRoom: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            user_rooms[key] == undefined && // user_room doesn't exist yet
            (user_room.userStatus == "invited" ||
                user_room.userStatus == "requested" ||
                (user_room.userStatus == "owner" && user_room.userName == roomOwner.userName)) && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            user_rooms[key] = user_room;
            return true;
        }
        return false;
    },
    updateUserRoomStatus: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            user_rooms[key] != undefined && // user_room exists
            ((user_rooms[key].userStatus == "invited" && user_room.userStatus == "member") ||
                (user_rooms[key].userStatus == "requested" && user_room.userStatus == "member")) && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            user_rooms[key] = user_room;
            return true;
        }
        return false;
    },
    deleteUserRoom: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            user_rooms[key] != undefined && // user_room exists
            user_rooms[key].userStatus == user_room.userStatus && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            delete user_rooms[key];
            return true;
        }
        return false;
    },
}

module.exports = testDB;