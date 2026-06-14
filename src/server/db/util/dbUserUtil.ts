import { UserType, UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTION_USERS, GUEST_MAX_AGE_BY_TIER_PHASE } from "../../system/serverConstants";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";

const DBUserUtil =
{
    createUser: async (userName: string, userType: UserType,
        email: string, singlePlayerMode: string = TUTORIAL_SINGLE_PLAYER_MODE): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBUserUtil.createUser", {userName, userType, email, singlePlayerMode}, "low", "info");
        const user: DBUser = {
            version: DBUserVersionMigration.length,
            userName,
            userType,
            email,
            singlePlayerMode,
            lastRoomID: "",
            lastLoginAt: Date.now(),
            createdAt: Date.now(),
            loginCount: 0,
            ownedRoomID: "",
            playerMetadata: {},
        };
        const result = await new DBQuery<{id: string}>()
            .insertInto(COLLECTION_USERS)
            .values(user)
            .run();
        return result;
    },
    findUserById: async (userID: string): Promise<DBUser | null> =>
    {
        LogUtil.log("DBUserUtil.findUserById", {userID}, "low", "info");
        const result = await new DBQuery<DBUser>()
            .select()
            .from(COLLECTION_USERS)
            .where("id", "==", userID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return result.data[0];
    },
    setSinglePlayerMode: async (userID: string, singlePlayerMode: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setSinglePlayerMode", {userId: userID, singlePlayerMode}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({"singlePlayerMode": singlePlayerMode})
            .where("id", "==", userID)
            .run();
        return result;
    },
    setLastRoomID: async (userID: string, roomID: string): Promise<void> =>
    {
        LogUtil.log("DBUserUtil.setLastRoomID", {userID, roomID}, "low", "info");
        await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({ lastRoomID: roomID })
            .where("id", "==", userID)
            .run();
    },
    savePlayerMetadata: async (userID: string, playerMetadata: {[key: string]: string}): Promise<void> =>
    {
        LogUtil.log("DBUserUtil.savePlayerMetadata", {userID}, "low", "info");
        await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({ playerMetadata })
            .where("id", "==", userID)
            .run();
    },
    saveMultipleUsersPlayerMetadata: async (
        updates: Array<{userID: string; playerMetadata: {[key: string]: string}}>
    ): Promise<void> =>
    {
        if (updates.length == 0)
            return;
        LogUtil.log("DBUserUtil.saveMultipleUsersPlayerMetadata", {count: updates.length}, "low", "info");
        const userQueries = updates.map(u =>
            new DBQuery<DBRow>()
                .update(COLLECTION_USERS)
                .set({ playerMetadata: u.playerMetadata })
                .where("id", "==", u.userID)
        );
        await DBQuery.runAll(userQueries);
    },
    upgradeGuestToMember: async (userID: string, userName: string, email: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.upgradeGuestToMember", {userID, userName, email}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({
                userName,
                userType: UserTypeEnumMap.Member,
                email,
            })
            .where("id", "==", userID)
            .run();
        return result;
    },
    updateLastLogin: async (userID: string): Promise<void> =>
    {
        // Cache invalidation must NOT happen here ((Reason 1): Cache invalidation in this case will immediately invalidate the cache of a user who is currently logging in, resulting in redundant DB lookups. (Reason 2): 'lastLoginAt' and 'loginCount' are only used by deleteStaleGuestsByTier)
        await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .noInvalidate()
            .set({ lastLoginAt: Date.now(), loginCount: FieldValue.increment(1) })
            .where("id", "==", userID)
            .run();
    },
    deleteStaleGuestsByTier: async (phase: number): Promise<number> =>
    {
        const cutoffTime = Date.now() - GUEST_MAX_AGE_BY_TIER_PHASE[phase];

        const selectResult = await new DBQuery<DBUser>()
            .select()
            .from(COLLECTION_USERS)
            .where("userType", "==", UserTypeEnumMap.Guest)
            .where("lastLoginAt", "<", cutoffTime)
            .run();

        if (!selectResult.success || selectResult.data.length === 0)
            return 0;

        // Filter in-memory by tier engagement criteria (loginCount only).
        const tierFilter = (doc: DBUser): boolean => {
            const loginCount = doc.loginCount ?? 0;

            let tierPhase = 0; // 0 = disposable, 1 = casual, 2 = dedicated
            if (loginCount > 3)
                tierPhase = 2;
            else if (loginCount > 1)
                tierPhase = 1;

            return phase == tierPhase;
        };

        const toDelete = selectResult.data.filter(tierFilter);
        if (toDelete.length === 0)
            return 0;
        const deleteQueries = toDelete
            .filter(doc => doc.id)
            .map(doc => new DBQuery<DBRow>()
                .delete()
                .from(COLLECTION_USERS)
                .where("id", "==", doc.id as string)
            );
        await DBQuery.runAll(deleteQueries);

        return toDelete.length;
    },
    deleteUser: async (userID: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.deleteUser", {userID}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .delete()
            .from(COLLECTION_USERS)
            .where("id", "==", userID)
            .run();
        return result;
    },
    setOwnedRoomID: async (userID: string, roomID: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setOwnedRoomID", {userID, roomID}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({ ownedRoomID: roomID })
            .where("id", "==", userID)
            .run();
        return result;
    },
    fromDBType(dbUser: DBUser): User
    {
        return new User(
            dbUser.id,
            dbUser.userName,
            dbUser.userType,
            dbUser.email,
            dbUser.singlePlayerMode,
            dbUser.lastRoomID ?? "",
            dbUser.ownedRoomID ?? ""
        );
    },
}

export default DBUserUtil;
