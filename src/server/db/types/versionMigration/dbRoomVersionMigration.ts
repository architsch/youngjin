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
    // v3 -> v4: drop the stored "id" field.
    //
    // A room's identity is the document's key, and rooms written before that was enforced also
    // carry a copy of it as a field — sometimes correct, sometimes the empty string the room had
    // before the DB assigned it one. Nothing reads that copy, but leaving it means rooms come in
    // two shapes, and the next person to write a query has to know which.
    //
    // The step itself changes nothing: it is the version bump that matters, because that is what
    // makes a read rewrite the row, and every write already drops the field (DBRowIdentityUtil).
    // Removing "id" here instead would strip it from the row on its way to the caller, who needs
    // it.
    async (row: any) => row,
];

export default DBRoomVersionMigration;
