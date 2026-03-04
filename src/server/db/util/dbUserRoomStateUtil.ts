import DBQuery from "../types/dbQuery";
import DBUserRoomState from "../types/row/dbUserRoomState";
import DBUserRoomStateVersionMigration from "../types/versionMigration/dbUserRoomStateVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import { DBRow } from "../types/row/dbRow";
import { COLLECTION_USER_ROOM_STATES } from "../../system/serverConstants";

function makeCompositeId(userID: string, roomID: string): string
{
    return `${userID}_${roomID}`;
}

const DBUserRoomStateUtil =
{
    findByUserAndRoom: async (userID: string, roomID: string): Promise<DBUserRoomState | null> =>
    {
        const compositeId = makeCompositeId(userID, roomID);
        LogUtil.log("DBUserRoomStateUtil.findByUserAndRoom", {userID, roomID}, "low", "info");
        const result = await new DBQuery<DBUserRoomState>()
            .select()
            .from(COLLECTION_USER_ROOM_STATES)
            .where("id", "==", compositeId)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return result.data[0];
    },
    saveUserRoomState: async (userID: string, roomID: string,
        lastX: number, lastY: number, lastZ: number,
        lastDirX: number, lastDirY: number, lastDirZ: number,
        playerMetadata: {[key: string]: string}): Promise<void> =>
    {
        const compositeId = makeCompositeId(userID, roomID);
        LogUtil.log("DBUserRoomStateUtil.saveUserRoomState", {userID, roomID}, "low", "info");
        const state: DBUserRoomState = {
            version: DBUserRoomStateVersionMigration.length,
            userID,
            roomID,
            lastX,
            lastY,
            lastZ,
            lastDirX,
            lastDirY,
            lastDirZ,
            playerMetadata,
        };
        await new DBQuery<DBRow>()
            .insertIntoWithId(COLLECTION_USER_ROOM_STATES, compositeId)
            .values(state)
            .run();
    },
    makeCompositeId,
}

export default DBUserRoomStateUtil;
