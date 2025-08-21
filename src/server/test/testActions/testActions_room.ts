import SearchDB from "../../db/searchDB";
import DebugUtil from "../../util/debugUtil";
import TestDB from "../testDB";
import TestHTTP from "../testHTTP";

const routePath = "/api/room/";

const actionOnExistingRoom = async (method: string, routeName: string, room: TestRoom,
    sourceUser: TestUser, targetUser?: TestUser): Promise<void> =>
{
    const roomsFound = await SearchDB.rooms.withRoomName(room.roomName);
    const usersFound = targetUser ? await SearchDB.users.withUserName(targetUser.userName) : undefined;

    const roomID = (!roomsFound || roomsFound.length == 0) ?
        Math.floor(Math.random() * 1000) : roomsFound[0].roomID;
    const userID = (!usersFound || usersFound.length == 0) ?
        Math.floor(Math.random() * 1000) : usersFound[0].userID;

    const body = {roomID, userID};

    await TestHTTP.makeRequest(sourceUser.userName, method, `${routePath}${routeName}`, body);
};

const TestActions_Room =
{
    //------------------------------------------------------------------------------------
    // Core
    //------------------------------------------------------------------------------------

    create: async (room: TestRoom, user: TestUser): Promise<void> => {
        if (!TestDB.insertRoom(room, user))
            return;
        DebugUtil.log("testActions_room.create", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await TestHTTP.makeRequest(user.userName, "POST", `${routePath}create`, {roomName: room.roomName});
    },
    delete: async (room: TestRoom, user: TestUser): Promise<void> => {
        if (!TestDB.deleteRoom(room, user))
            return;
        DebugUtil.log("testActions_room.delete", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "delete", room, user);
    },
    leave: async (room: TestRoom, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"}, user))
            return;
        DebugUtil.log("testActions_room.leave", {roomName: room.roomName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "leave", room, user);
    },

    //------------------------------------------------------------------------------------
    // API for rooms.ejs
    //------------------------------------------------------------------------------------

    acceptInvitation: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.acceptInvitation", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("PUT", "accept-invitation", room, user);
    },
    ignoreInvitation: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.ignoreInvitation", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "ignore-invitation", room, user);
    },
    requestToJoin: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.insertRoomMembership({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.requestToJoin", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("POST", "request-to-join", room, user);
    },
    cancelRequest: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.cancelRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "cancel-request", room, user);
    },

    //------------------------------------------------------------------------------------
    // API for roomMembers.ejs
    //------------------------------------------------------------------------------------

    invite: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.insertRoomMembership({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.invite", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("POST", "invite", room, roomOwner, user);
    },
    cancelInvite: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "invited"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.cancelInvite", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "cancel-invite", room, roomOwner, user);
    },
    acceptRequest: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.updateUserRoomStatus({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.acceptRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("PUT", "accept-request", room, roomOwner, user);
    },
    ignoreRequest: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "requested"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.ignoreRequest", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "ignore-request", room, roomOwner, user);
    },
    kickout: async (room: TestRoom, roomOwner: TestUser, user: TestUser): Promise<void> => {
        if (!TestDB.deleteUserRoom({roomName: room.roomName, userName: user.userName, userStatus: "member"}, roomOwner))
            return;
        DebugUtil.log("testActions_room.kickout", {roomName: room.roomName, ownerUserName: roomOwner.userName, userName: user.userName}, "high", "cyan");
        await actionOnExistingRoom("DELETE", "kickout", room, roomOwner, user);
    },
}

export default TestActions_Room;