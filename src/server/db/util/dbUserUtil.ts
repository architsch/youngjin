import { UserType, UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import UserGameplayState from "../../user/types/userGameplayState";
import { FIRST_TUTORIAL_STEP, HOUR_IN_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import { FieldValue } from "firebase-admin/firestore";
import { GUEST_MAX_AGE_BY_TIER_PHASE } from "../../system/serverConstants";

const DBUserUtil =
{
    createUser: async (userName: string, userType: UserType,
        email: string): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBUserUtil.createUser", {userName, userType, email}, "low", "info");
        const user: DBUser = {
            version: DBUserVersionMigration.length,
            userName,
            userType,
            email,
            tutorialStep: FIRST_TUTORIAL_STEP,
            lastRoomID: "",
            lastX: 16, // center of the room (16 = half of the room's size)
            lastY: 0,
            lastZ: 16, // center of the room (16 = half of the room's size)
            lastDirX: 0,
            lastDirY: 0,
            lastDirZ: 1,
            playerMetadata: {},
            lastLoginAt: Date.now(),
            createdAt: Date.now(),
            loginCount: 0,
            totalPlaytimeMs: 0,
        };
        const result = await new DBQuery<{id: string}>()
            .insertInto("users")
            .values(user)
            .run();
        return result;
    },
    findUserById: async (userID: string): Promise<DBUser | null> =>
    {
        LogUtil.log("DBUserUtil.findUserById", {userID}, "low", "info");
        const result = await new DBQuery<DBUser>()
            .select()
            .from("users")
            .where("id", "==", userID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;
        return result.data[0];
    },
    setUserTutorialStep: async (userID: string, tutorialStep: number): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setUserTutorialStep", {userId: userID, tutorialStep}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update("users")
            .set({"tutorialStep": tutorialStep})
            .where("id", "==", userID)
            .run();
        return result;
    },
    saveUserGameplayState: async (gameplayState: UserGameplayState): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.saveUserGameplayState", gameplayState, "low", "info");
        const columnValues: DBRow = {
            lastRoomID: gameplayState.lastRoomID,
            lastX: gameplayState.lastX,
            lastY: gameplayState.lastY,
            lastZ: gameplayState.lastZ,
            lastDirX: gameplayState.lastDirX,
            lastDirY: gameplayState.lastDirY,
            lastDirZ: gameplayState.lastDirZ,
            playerMetadata: gameplayState.playerMetadata,
        };
        if (gameplayState.sessionDurationMs != undefined)
            columnValues.totalPlaytimeMs = FieldValue.increment(gameplayState.sessionDurationMs);
        const result = await new DBQuery<DBRow>()
            .update("users")
            .set(columnValues)
            .where("id", "==", gameplayState.userID)
            .run();
        return result;
    },
    saveMultipleUsersGameplayState: async (gameplayStates: UserGameplayState[]): Promise<void> =>
    {
        if (gameplayStates.length == 0)
            return;
        LogUtil.log("DBUserUtil.saveMultipleUsersGameplayState", {count: gameplayStates.length}, "low", "info");
        const queries = gameplayStates.map(gs => {
            const columnValues: DBRow = {
                lastRoomID: gs.lastRoomID,
                lastX: gs.lastX,
                lastY: gs.lastY,
                lastZ: gs.lastZ,
                lastDirX: gs.lastDirX,
                lastDirY: gs.lastDirY,
                lastDirZ: gs.lastDirZ,
                playerMetadata: gs.playerMetadata,
            };
            if (gs.sessionDurationMs != undefined)
                columnValues.totalPlaytimeMs = FieldValue.increment(gs.sessionDurationMs);
            return new DBQuery<DBRow>()
                .update("users")
                .set(columnValues)
                .where("id", "==", gs.userID);
        });
        await DBQuery.runAll(queries);
    },
    upgradeGuestToMember: async (userID: string, userName: string, email: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.upgradeGuestToMember", {userID, userName, email}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update("users")
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
            .update("users")
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
            .from("users")
            .where("userType", "==", UserTypeEnumMap.Guest)
            .where("lastLoginAt", "<", cutoffTime)
            .run();

        if (!selectResult.success || selectResult.data.length === 0)
            return 0;

        // Filter in-memory by tier engagement criteria
        const tierFilter = (doc: DBUser): boolean => {
            const loginCount = doc.loginCount ?? 0;
            const totalPlaytimeMs = doc.totalPlaytimeMs ?? 0;

            let tierPhase = 0; // 0 = disposable, 1 = casual, 2 = dedicated
            if (loginCount > 3 && totalPlaytimeMs >= HOUR_IN_MS)
                tierPhase = 2;
            else if (loginCount > 1 && totalPlaytimeMs >= 10 * MINUTE_IN_MS)
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
                .from("users")
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
            .from("users")
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
            dbUser.tutorialStep,
            dbUser.lastRoomID ?? "",
            dbUser.lastX ?? 16,
            dbUser.lastY ?? 0,
            dbUser.lastZ ?? 16,
            dbUser.lastDirX ?? 0,
            dbUser.lastDirY ?? 0,
            dbUser.lastDirZ ?? 1,
            (dbUser.playerMetadata as {[key: string]: string}) ?? {}
        );
    },
}

export default DBUserUtil;
