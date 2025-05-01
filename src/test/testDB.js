const textUtil = require("../shared/util/textUtil.mjs").textUtil;

let users = {};
let rooms = {};
let user_rooms = {};
let emailVerifications = {};

const isRoomOwner = (room, user) => user_rooms.filter(x =>
    x.roomName == room.roomName &&
    x.userName == user.userName &&
    x.userStatus == "owner"
).length > 0;

const testDB =
{
    _reset: () =>
    {
        users = {}; // user = {userName, password, email}
        rooms = {}; // room = {roomName}
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
            users[user.userName] = user;
    },
    deleteUser: (user) =>
    {
        if (users[user.userName] != undefined) // user exists
            delete users[user.userName];
    },
    insertEmailVerification: (emailVerification) =>
    {
        if (emailVerifications[emailVerification.email] == undefined) // emailVerification doesn't exist yet
            emailVerifications[emailVerification.email] = emailVerification;
    },
    deleteEmailVerification: (emailVerification) =>
    {
        if (emailVerifications[emailVerification.email] != undefined) // emailVerification exists
            delete emailVerifications[emailVerification.email];
    },
    insertRoom: (room, roomOwner) =>
    {
        if (rooms[room.roomName] == undefined) // room doesn't exist yet
        {
            rooms[room.roomName] = room;
            testDB.insertUserRoom({roomName: room.roomName, userName: roomOwner.userName, userStatus: "owner"}, roomOwner);
        }
    },
    deleteRoom: (room, roomOwner) =>
    {
        if (rooms[room.roomName] != undefined && // room exists
            isRoomOwner(room, roomOwner)) // owner is correct
        {
            delete rooms[room.roomName];
            user_rooms
                .filter(x => x.roomName == room.roomName)
                .map(x => `${x.roomName} :: ${x.userName}`)
                .forEach(key => delete user_rooms[key]);
        }
    },
    insertUserRoom: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (user_rooms[key] == undefined && // user_room doesn't exist yet
            (user_room.userStatus == "invited" ||
                user_room.userStatus == "requested" ||
                (user_room.userStatus == "owner" && user_room.userName == roomOwner.userName)) && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            user_rooms[key] = user_room;
        }
    },
    updateUserRoomStatus: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (user_rooms[key] != undefined && // user_room exists
            ((user_rooms[key].userStatus == "invited" && user_room.userStatus == "member") ||
                (user_rooms[key].userStatus == "requested" && user_room.userStatus == "member")) && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            user_rooms[key] = user_room;
        }
    },
    deleteUserRoom: (user_room, roomOwner) =>
    {
        const key = `${user_room.roomName} :: ${user_room.userName}`;
        if (user_rooms[key] != undefined && // user_room exists
            user_rooms[key].userStatus == user_room.userStatus && // userStatus makes sense
            rooms[user_room.roomName] != undefined && // room exists
            isRoomOwner(rooms[user_room.roomName], roomOwner)) // owner is correct
        {
            delete user_rooms[key];
        }
    },
}

module.exports = testDB;