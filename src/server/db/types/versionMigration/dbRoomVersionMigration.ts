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
    // v1 -> v2: add editors[] (formerly in the retired userRoomStates collection).
    async (row: any) => {
        row.editors = [];
        return row;
    },
    // v2 -> v3: add "roomName" (distinguishes single-player rooms).
    async (row: any) => {
        row.roomName = "";
        return row;
    },
    // v3 -> v4: drop the stored "id" field. The bump alone forces a rewrite, and writes already strip
    // "id" (DBRowIdentityUtil); removing it here would strip it from the returned row.
    async (row: any) => row,
    // v4 -> v5: drop "editors" (permissions are now derived from user and room).
    async (row: any) => {
        delete row.editors;
        return row;
    },
    // v5 -> v6: add "prefs" (atmosphere). "" decodes to the defaults (see RoomPrefsUtil).
    async (row: any) => {
        row.prefs = row.prefs ?? "";
        return row;
    },
];

export default DBRoomVersionMigration;
