const dbSearch = require("../../server/db/dbSearch");
const testDB = require("../testDB");
const testHTTP = require("../testHTTP");

const routePath = "/api/room/";

const actionOnExistingRoom = async (method, routeName, room, sourceUser, targetUser = undefined) => {
    testHTTP.switchUser(sourceUser.userName);

    const body = {roomID: await dbSearch.rooms.withRoomName(undefined, room.roomName)[0].roomID};
    if (targetUser != undefined)
        body.userID = await dbSearch.users.withUserName(undefined, targetUser.userName)[0].userID;

    await testHTTP[method](`${routePath}${routeName}`, body);
};

const testActions_room =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    create: async (room, user) => {
        testHTTP.switchUser(user.userName);
        await testHTTP.post(`${routePath}create`, {roomName: room.roomName});
        testDB.insertRoom(room);
    },
    delete: async (room, user) => {
        await actionOnExistingRoom("delete", room, user);
        testDB.deleteRoom(room);
    },
    leave: async (room, user) => {
        await actionOnExistingRoom("leave", room, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"});
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (room, roomOwner, user) => {
        await actionOnExistingRoom("put", "accept-invitation", room, user);
        testDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner);
    },
    ignoreInvitation: async (room, roomOwner, user) => {
        await actionOnExistingRoom("delete", "ignore-invitation", room, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner);
    },
    requestToJoin: async (room, roomOwner, user) => {
        await actionOnExistingRoom("post", "request-to-join", room, user);
        testDB.insertUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner);
    },
    cancelRequest: async (room, roomOwner, user) => {
        await actionOnExistingRoom("delete", "cancel-request", room, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner);
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (room, roomOwner, user) => {
        await actionOnExistingRoom("post", "invite", room, roomOwner, user);
        testDB.insertUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner);
    },
    cancelInvite: async (room, roomOwner, user) => {
        await actionOnExistingRoom("delete", "cancel-invite", room, roomOwner, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"});
    },
    acceptRequest: async (room, roomOwner, user) => {
        await actionOnExistingRoom("put", "accept-request", room, roomOwner, user);
        testDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner);
    },
    ignoreRequest: async (room, roomOwner, user) => {
        await actionOnExistingRoom("delete", "ignore-request", room, roomOwner, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"});
    },
    kickout: async (room, roomOwner, user) => {
        await actionOnExistingRoom("delete", "kickout", room, roomOwner, user);
        testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"});
    },
}

module.exports = testActions_room;