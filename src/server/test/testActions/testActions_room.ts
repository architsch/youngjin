import dbSearch from "../../db/dbSearch";
import debugUtil from "../../util/debugUtil";
import testDB from "../testDB";
import testHTTP from "../testHTTP";

const routePath = "/api/room/";

const actionOnExistingRoom = async (method: string, routeName: string, room: testRoom,
    sourceUser: testUser, targetUser?: testUser): Promise<void> =>
{
    const roomsFound = await dbSearch.rooms.withRoomName(room.roomName);
    const usersFound = targetUser ? await dbSearch.users.withUserName(targetUser.userName) : undefined;

    const roomID = (!roomsFound || roomsFound.length == 0) ?
        Math.floor(Math.random() * 1000) : roomsFound[0].roomID;
    const userID = (!usersFound || usersFound.length == 0) ?
        Math.floor(Math.random() * 1000) : usersFound[0].userID;

    const body = {roomID, userID};

    await testHTTP.makeRequest(sourceUser.userName, method, `${routePath}${routeName}`, body);
};

const testActions_room =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    create: async (room: testRoom, user: testUser): Promise<void> => {
        if (!testDB.insertRoom(room, user))
            return;
        debugUtil.log("testActions_room.create", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await testHTTP.makeRequest(user.userName, "POST", `${routePath}create`, {roomName: room.roomName});
    },
    delete: async (room: testRoom, user: testUser): Promise<void> => {
        if (!testDB.deleteRoom(room, user))
            return;
        debugUtil.log("testActions_room.delete", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "delete", room, user);
    },
    leave: async (room: testRoom, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"}, user))
            return;
        debugUtil.log("testActions_room.leave", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "leave", room, user);
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        debugUtil.log("testActions_room.acceptInvitation", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("PUT", "accept-invitation", room, user);
    },
    ignoreInvitation: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        debugUtil.log("testActions_room.ignoreInvitation", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "ignore-invitation", room, user);
    },
    requestToJoin: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.insertUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        debugUtil.log("testActions_room.requestToJoin", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("POST", "request-to-join", room, user);
    },
    cancelRequest: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        debugUtil.log("testActions_room.cancelRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "cancel-request", room, user);
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.insertUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        debugUtil.log("testActions_room.invite", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("POST", "invite", room, roomOwner, user);
    },
    cancelInvite: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        debugUtil.log("testActions_room.cancelInvite", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "cancel-invite", room, roomOwner, user);
    },
    acceptRequest: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        debugUtil.log("testActions_room.acceptRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("PUT", "accept-request", room, roomOwner, user);
    },
    ignoreRequest: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        debugUtil.log("testActions_room.ignoreRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "ignore-request", room, roomOwner, user);
    },
    kickout: async (room: testRoom, roomOwner: testUser, user: testUser): Promise<void> => {
        if (!testDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        debugUtil.log("testActions_room.kickout", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "kickout", room, roomOwner, user);
    },
}

export default testActions_room;