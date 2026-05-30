import { DBVersionMigration } from "./dbVersionMigration";
import DBUserUtil from "../../util/dbUserUtil";

const DBRoomVersionMigration: DBVersionMigration = [
    // v0 -> v1: introduce ownerUserName (denormalized for room listings).
    async (row: any) => {
        let ownerUserName = "";
        if (row.ownerUserID && row.ownerUserID.length > 0)
        {
            const dbUser = await DBUserUtil.findUserById(row.ownerUserID);
            if (dbUser?.userName)
                ownerUserName = dbUser.userName;
        }
        return { ...row, ownerUserName };
    },
    // v1 -> v2: introduce editors[]. Per-(user, room) editor roles were previously
    // stored in the userRoomStates collection, which has been retired; the editor
    // list now lives directly on the room as a denormalized {userID, userName, email}
    // snapshot for cheap rendering in the room-configuration UI.
    async (row: any) => {
        row.editors = [];
        return row;
    },
    // v2 -> v3: add a new field called "roomName".
    // The purpose of this is to let us distinguish between different singleplayer rooms
    // (based upon their names).
    async (row: any) => {
        row.roomName = "";
        return row;
    },
];

export default DBRoomVersionMigration;
