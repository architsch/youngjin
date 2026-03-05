import DBQuery from "../types/dbQuery";
import DBUserRoomState from "../types/row/dbUserRoomState";
import DBUserRoomStateVersionMigration from "../types/versionMigration/dbUserRoomStateVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import { DBRow } from "../types/row/dbRow";
import { COLLECTION_USER_ROOM_STATES } from "../../system/serverConstants";
import { UserRole } from "../../../shared/user/types/userRole";

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
    saveUserRoomState: async (userID: string, userName: string, email: string, roomID: string,
        lastX: number, lastY: number, lastZ: number,
        lastDirX: number, lastDirY: number, lastDirZ: number,
        playerMetadata: {[key: string]: string},
        userRole: UserRole): Promise<void> =>
    {
        const compositeId = makeCompositeId(userID, roomID);
        LogUtil.log("DBUserRoomStateUtil.saveUserRoomState", {userID, roomID}, "low", "info");
        const state: DBUserRoomState = {
            version: DBUserRoomStateVersionMigration.length,
            userID,
            userName,
            email,
            roomID,
            userRole,
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
    setUserRole: async (userID: string, userName: string, email: string, roomID: string, userRole: UserRole): Promise<void> =>
    {
        const compositeId = makeCompositeId(userID, roomID);
        LogUtil.log("DBUserRoomStateUtil.setUserRole", {userID, roomID, userRole}, "low", "info");
        const existing = await DBUserRoomStateUtil.findByUserAndRoom(userID, roomID);
        if (existing) // If the userRoomState already exists, just update its userRole.
        {
            await new DBQuery<DBRow>()
                .update(COLLECTION_USER_ROOM_STATES)
                .set({ userRole })
                .where("id", "==", compositeId)
                .run();
        }
        else // If the userRoomState doesn't exist yet, create one (Set its userRole to the designated value, and initialize the rest of the properties with their default values)
        {
            const state: DBUserRoomState = {
                version: DBUserRoomStateVersionMigration.length,
                userID,
                userName,
                email,
                roomID,
                userRole,
                lastX: 16,
                lastY: 0,
                lastZ: 16,
                lastDirX: 0,
                lastDirY: 0,
                lastDirZ: 1,
                playerMetadata: {},
            };
            await new DBQuery<DBRow>()
                .insertIntoWithId(COLLECTION_USER_ROOM_STATES, compositeId)
                .values(state)
                .run();
        }
    },
    makeCompositeId,
}

export default DBUserRoomStateUtil;
