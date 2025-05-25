import debugUtil from "../util/debugUtil";
import textUtil from "../../shared/util/textUtil";

let users: {[userName: string]: testUser} = {};
let rooms: {[roomName: string]: testRoom} = {};
let user_rooms: {[roomAndUserNames: string]: testUser_room} = {};
let emailVerifications: {[email: string]: testEmailVerification} = {};

const isRoomOwner = (room: testRoom, user: testUser) => room.ownerUserName == user.userName;

const testDB =
{
    _reset: (): void =>
    {
        users = {};
        rooms = {};
        user_rooms = {};
        emailVerifications = {};
    },
    toString: (): string =>
    {
        return JSON.stringify({users, rooms, user_rooms}, null, 4);
    },
    toHTMLString: (): string => {
        const section = (text: string) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj: {[key: string]: any}) => textUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(users) +
            section("rooms") + toSafeStr(rooms) +
            section("user_rooms") + toSafeStr(user_rooms) +
            section("emailVerifications") + toSafeStr(emailVerifications);
        return content;
    },
    insertUser: (user: testUser): boolean =>
    {
        if (users[user.userName] == undefined) // user doesn't exist yet
        {
            users[user.userName] = user;
            return true;
        }
        return false;
    },
    deleteUser: (user: testUser): boolean =>
    {
        if (users[user.userName] != undefined) // user exists
        {
            delete users[user.userName];
            return true;
        }
        return false;
    },
    insertEmailVerification: (emailVerification: testEmailVerification): boolean =>
    {
        if (emailVerifications[emailVerification.email] == undefined) // emailVerification doesn't exist yet
        {
            emailVerifications[emailVerification.email] = emailVerification;
            return true;
        }
        return false;
    },
    deleteEmailVerification: (emailVerification: testEmailVerification): boolean =>
    {
        if (emailVerifications[emailVerification.email] != undefined) // emailVerification exists
        {
            delete emailVerifications[emailVerification.email];
            return true;
        }
        return false;
    },
    insertRoom: (room: testRoom, roomOwner: testUser): boolean =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] == undefined) // room doesn't exist yet
        {
            room.ownerUserName = roomOwner.userName;
            rooms[room.roomName] = room;
            if (!testDB.insertUserRoom({roomName: room.roomName, userName: roomOwner.userName, userStatus: "owner"}, roomOwner))
            {
                debugUtil.log(`Error: insertRoom succeeded but insertUserRoom failed.`, {room, roomOwner}, "high", "pink");
                room.ownerUserName = ""; // revert change
                delete rooms[room.roomName]; // revert change
                return false;
            }
            return true;
        }
        return false;
    },
    deleteRoom: (room: testRoom, roomOwner: testUser): boolean =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] != undefined && // room exists
            isRoomOwner(room, roomOwner)) // owner is correct
        {
            room.ownerUserName = "";
            delete rooms[room.roomName];

            const deletePendingKeys: string[] = [];
            Object.values(user_rooms)
                .filter(x => x.roomName == room.roomName)
                .map(x => `${x.roomName} :: ${x.userName}`)
                .forEach(key => deletePendingKeys.push(key));
            for (const key of deletePendingKeys)
                delete user_rooms[key];
            return true;
        }
        return false;
    },
    insertUserRoom: (user_room: testUser_room, roomOwner: testUser): boolean =>
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
    updateUserRoomStatus: (user_room: testUser_room, roomOwner: testUser): boolean =>
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
    deleteUserRoom: (user_room: testUser_room, roomOwner: testUser): boolean =>
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

export default testDB;