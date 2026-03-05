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
import { COLLECTION_USERS, GUEST_MAX_AGE_BY_TIER_PHASE } from "../../system/serverConstants";
import DBUserRoomStateUtil from "./dbUserRoomStateUtil";

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
            lastLoginAt: Date.now(),
            createdAt: Date.now(),
            loginCount: 0,
            totalPlaytimeMs: 0,
            ownedRoomID: "",
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
    setUserTutorialStep: async (userID: string, tutorialStep: number): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setUserTutorialStep", {userId: userID, tutorialStep}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({"tutorialStep": tutorialStep})
            .where("id", "==", userID)
            .run();
        return result;
    },
    saveUserGameplayState: async (gameplayState: UserGameplayState): Promise<void> =>
    {
        LogUtil.log("DBUserUtil.saveUserGameplayState", gameplayState, "low", "info");

        // 1. Update lastRoomID (and optionally totalPlaytimeMs) on the user document
        const userColumnValues: DBRow = {
            lastRoomID: gameplayState.lastRoomID,
        };
        if (gameplayState.sessionDurationMs != undefined)
            userColumnValues.totalPlaytimeMs = FieldValue.increment(gameplayState.sessionDurationMs);
        await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set(userColumnValues)
            .where("id", "==", gameplayState.userID)
            .run();

        // 2. Save per-room state (position, direction, metadata) to userRoomStates
        await DBUserRoomStateUtil.saveUserRoomState(
            gameplayState.userID, gameplayState.userName, gameplayState.email, gameplayState.lastRoomID,
            gameplayState.lastX, gameplayState.lastY, gameplayState.lastZ,
            gameplayState.lastDirX, gameplayState.lastDirY, gameplayState.lastDirZ,
            gameplayState.playerMetadata,
            gameplayState.userRole
        );
    },
    saveMultipleUsersGameplayState: async (gameplayStates: UserGameplayState[]): Promise<void> =>
    {
        if (gameplayStates.length == 0)
            return;
        LogUtil.log("DBUserUtil.saveMultipleUsersGameplayState", {count: gameplayStates.length}, "low", "info");

        // 1. Batch update lastRoomID (and optionally totalPlaytimeMs) on user documents
        const userQueries = gameplayStates.map(gs => {
            const columnValues: DBRow = {
                lastRoomID: gs.lastRoomID,
            };
            if (gs.sessionDurationMs != undefined)
                columnValues.totalPlaytimeMs = FieldValue.increment(gs.sessionDurationMs);
            return new DBQuery<DBRow>()
                .update(COLLECTION_USERS)
                .set(columnValues)
                .where("id", "==", gs.userID);
        });
        await DBQuery.runAll(userQueries);

        // 2. Save per-room states individually (each is an upsert with a specific doc ID)
        await Promise.all(gameplayStates.map(gs => {
            return DBUserRoomStateUtil.saveUserRoomState(
                gs.userID, gs.userName, gs.email, gs.lastRoomID,
                gs.lastX, gs.lastY, gs.lastZ,
                gs.lastDirX, gs.lastDirY, gs.lastDirZ,
                gs.playerMetadata,
                gs.userRole
            );
        }));
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
            dbUser.tutorialStep,
            dbUser.lastRoomID ?? "",
            dbUser.ownedRoomID ?? ""
        );
    },
}

export default DBUserUtil;
