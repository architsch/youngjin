import DebugUtil from "../util/debugUtil";
import TextUtil from "../../shared/util/textUtil";

let users: {[userName: string]: TestUser} = {};
let rooms: {[roomName: string]: TestRoom} = {};
let roomMemberships: {[roomAndUserNames: string]: TestRoomMembership} = {};
let emailVerifications: {[email: string]: TestEmailVerification} = {};

const isRoomOwner = (room: TestRoom, user: TestUser) => room.ownerUserName == user.userName;

const TestDB =
{
    _reset: (): void =>
    {
        users = {};
        rooms = {};
        roomMemberships = {};
        emailVerifications = {};
    },
    toString: (): string =>
    {
        return JSON.stringify({users, rooms, roomMemberships}, null, 4);
    },
    toHTMLString: (): string => {
        const section = (text: string) => `\n\n<h1>${text}</h1>\n`;
        const toSafeStr = (obj: {[key: string]: any}) => TextUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
        const content =
            section("users") + toSafeStr(users) +
            section("rooms") + toSafeStr(rooms) +
            section("roomMemberships") + toSafeStr(roomMemberships) +
            section("emailVerifications") + toSafeStr(emailVerifications);
        return content;
    },
    insertUser: (user: TestUser): boolean =>
    {
        if (users[user.userName] == undefined) // user doesn't exist yet
        {
            users[user.userName] = user;
            return true;
        }
        return false;
    },
    deleteUser: (user: TestUser): boolean =>
    {
        if (users[user.userName] != undefined) // user exists
        {
            delete users[user.userName];
            return true;
        }
        return false;
    },
    insertEmailVerification: (emailVerification: TestEmailVerification): boolean =>
    {
        if (emailVerifications[emailVerification.email] == undefined) // emailVerification doesn't exist yet
        {
            emailVerifications[emailVerification.email] = emailVerification;
            return true;
        }
        return false;
    },
    deleteEmailVerification: (emailVerification: TestEmailVerification): boolean =>
    {
        if (emailVerifications[emailVerification.email] != undefined) // emailVerification exists
        {
            delete emailVerifications[emailVerification.email];
            return true;
        }
        return false;
    },
    insertRoom: (room: TestRoom, roomOwner: TestUser): boolean =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] == undefined) // room doesn't exist yet
        {
            room.ownerUserName = roomOwner.userName;
            rooms[room.roomName] = room;
            if (!TestDB.insertRoomMembership({roomName: room.roomName, userName: roomOwner.userName, userStatus: "owner"}, roomOwner))
            {
                DebugUtil.log(`Error: insertRoom succeeded but insertUserRoom failed.`, {room, roomOwner}, "high", "pink");
                room.ownerUserName = ""; // revert change
                delete rooms[room.roomName]; // revert change
                return false;
            }
            return true;
        }
        return false;
    },
    deleteRoom: (room: TestRoom, roomOwner: TestUser): boolean =>
    {
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            rooms[room.roomName] != undefined && // room exists
            isRoomOwner(room, roomOwner)) // owner is correct
        {
            room.ownerUserName = "";
            delete rooms[room.roomName];

            const deletePendingKeys: string[] = [];
            Object.values(roomMemberships)
                .filter(x => x.roomName == room.roomName)
                .map(x => `${x.roomName} :: ${x.userName}`)
                .forEach(key => deletePendingKeys.push(key));
            for (const key of deletePendingKeys)
                delete roomMemberships[key];
            return true;
        }
        return false;
    },
    insertRoomMembership: (roomMembership: TestRoomMembership, roomOwner: TestUser): boolean =>
    {
        const key = `${roomMembership.roomName} :: ${roomMembership.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            roomMemberships[key] == undefined && // roomMembership doesn't exist yet
            (roomMembership.userStatus == "invited" ||
                roomMembership.userStatus == "requested" ||
                (roomMembership.userStatus == "owner" && roomMembership.userName == roomOwner.userName)) && // userStatus makes sense
            rooms[roomMembership.roomName] != undefined && // room exists
            isRoomOwner(rooms[roomMembership.roomName], roomOwner)) // owner is correct
        {
            roomMemberships[key] = roomMembership;
            return true;
        }
        return false;
    },
    updateUserRoomStatus: (roomMembership: TestRoomMembership, roomOwner: TestUser): boolean =>
    {
        const key = `${roomMembership.roomName} :: ${roomMembership.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            roomMemberships[key] != undefined && // roomMembership exists
            ((roomMemberships[key].userStatus == "invited" && roomMembership.userStatus == "member") ||
                (roomMemberships[key].userStatus == "requested" && roomMembership.userStatus == "member")) && // userStatus makes sense
            rooms[roomMembership.roomName] != undefined && // room exists
            isRoomOwner(rooms[roomMembership.roomName], roomOwner)) // owner is correct
        {
            roomMemberships[key] = roomMembership;
            return true;
        }
        return false;
    },
    deleteUserRoom: (roomMembership: TestRoomMembership, roomOwner: TestUser): boolean =>
    {
        const key = `${roomMembership.roomName} :: ${roomMembership.userName}`;
        if (users[roomOwner.userName] != undefined && // roomOwner exists
            roomMemberships[key] != undefined && // roomMembership exists
            roomMemberships[key].userStatus == roomMembership.userStatus && // userStatus makes sense
            rooms[roomMembership.roomName] != undefined && // room exists
            isRoomOwner(rooms[roomMembership.roomName], roomOwner)) // owner is correct
        {
            delete roomMemberships[key];
            return true;
        }
        return false;
    },
}

export default TestDB;