import { UserType, UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import { FieldValue } from "firebase-admin/firestore";
import { ACQUISITION_SOURCE_DIRECT, COLLECTION_USERS, GUEST_MAX_AGE_BY_TIER_PHASE, LOGIN_COUNT_MIN_GAP_MS } from "../../system/serverConstants";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import ServerAnalyticsManager from "../../analytics/serverAnalyticsManager";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";

const DBUserUtil =
{
    createUser: async (userName: string, userType: UserType,
        email: string, singlePlayerMode: string = TUTORIAL_SINGLE_PLAYER_MODE,
        acquisitionSource: string = ACQUISITION_SOURCE_DIRECT): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBUserUtil.createUser", {userName, userType, email, singlePlayerMode, acquisitionSource}, "low", "info");
        const createdAt = Date.now();
        const user: DBUser = {
            version: DBUserVersionMigration.length,
            userName,
            userType,
            email,
            singlePlayerMode,
            lastRoomID: "",
            lastLoginAt: createdAt,
            createdAt,
            loginCount: 0,
            ownedRoomID: "",
            ftue: "",
            acquisitionSource,
            // The arrival milestone is stamped here rather than recorded afterwards, so that the
            // row is never briefly present with an empty funnel — which a milestone arriving in the
            // same moment would then append to, losing the arrival.
            funnel: FunnelMilestoneEnumMap.Arrived,
            playerMetadata: {},
        };
        const result = await new DBQuery<{id: string}>()
            .insertInto(COLLECTION_USERS)
            .values(user)
            .run();

        if (result.success)
            await ServerAnalyticsManager.recordArrival(acquisitionSource, createdAt);

        return result;
    },
    // The lookup as the DB actually answers it: "the query failed" and "there is no such user"
    // are different answers, and a caller that *acts* on absence — rather than merely reporting
    // it — must not treat one as the other. Mistaking a failed lookup for a deleted account is
    // how a signed-in user gets silently replaced by a brand-new guest.
    lookUpUserById: async (userID: string): Promise<DBQueryResponse<DBUser>> =>
    {
        LogUtil.log("DBUserUtil.lookUpUserById", {userID}, "low", "info");
        return await new DBQuery<DBUser>()
            .select()
            .from(COLLECTION_USERS)
            .where("id", "==", userID)
            .run();
    },
    // The same lookup for callers whose answer to both "failed" and "absent" is identical (a 404,
    // a skipped enrichment step). They give up the distinction deliberately; anyone who needs it
    // reaches for lookUpUserById instead.
    findUserById: async (userID: string): Promise<DBUser | null> =>
    {
        const result = await DBUserUtil.lookUpUserById(userID);
        if (!result.success || result.data.length == 0)
            return null;
        return result.data[0];
    },
    setSinglePlayerMode: async (userID: string, singlePlayerMode: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setSinglePlayerMode", {userID, singlePlayerMode}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({"singlePlayerMode": singlePlayerMode})
            .where("id", "==", userID)
            .run();

        // Leaving single-player mode is how the tutorial ends, whether it was worked through or
        // skipped. Entering one is not a milestone, so only the empty mode counts.
        if (result.success && singlePlayerMode == "")
            await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.TutorialDone);

        return result;
    },
    setFTUE: async (userID: string, ftue: string): Promise<DBQueryResponse<DBRow>> =>
    {
        LogUtil.log("DBUserUtil.setFTUE", {userID, ftue}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .set({"ftue": ftue})
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

        // Only multiplayer rooms reach here — a single-player room is deliberately never stored as
        // the room to come back to (see ServerRoomManager). That is what makes this the point at
        // which somebody has genuinely left the tutorial behind and gone into the shared world,
        // rather than merely having been placed somewhere on arrival.
        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.EnteredRoom);
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

        if (result.success)
            await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.SignedUp);

        return result;
    },
    updateLastLogin: async (userID: string, prevLastLoginAt: number): Promise<void> =>
    {
        // Cache invalidation must NOT happen here ((Reason 1): Cache invalidation in this case will immediately invalidate the cache of a user who is currently logging in, resulting in redundant DB lookups. (Reason 2): 'lastLoginAt' and 'loginCount' are only used by deleteStaleGuestsByTier)
        // loginCount counts distinct logins, not requests: it only increments when the previous
        // login is at least LOGIN_COUNT_MIN_GAP_MS old, so the many identified requests fired
        // within a single visit don't inflate the engagement tier used by deleteStaleGuestsByTier.
        const isDistinctLogin = Date.now() - (prevLastLoginAt ?? 0) >= LOGIN_COUNT_MIN_GAP_MS;
        await new DBQuery<DBRow>()
            .update(COLLECTION_USERS)
            .noInvalidate()
            .set(isDistinctLogin
                ? { lastLoginAt: Date.now(), loginCount: FieldValue.increment(1) }
                : { lastLoginAt: Date.now() })
            .where("id", "==", userID)
            .run();

        // Retention, measured on the same definition of a distinct login that the engagement tiers
        // use: the gap is a day, so this fires for somebody who came back, never for a page
        // refresh or a second tab within one visit.
        if (isDistinctLogin)
            await ServerAnalyticsManager.recordReturnVisit(userID);
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

        if (!selectResult.success)
        {
            // Surface the failure instead of silently reporting "nothing to delete" — e.g. a
            // missing composite index (userType + lastLoginAt) makes this query fail on every
            // run, and without this log the cleanup task appears healthy while doing nothing.
            LogUtil.log("DBUserUtil.deleteStaleGuestsByTier - stale-guest query failed",
                { phase }, "high", "error");
            return 0;
        }
        if (selectResult.data.length === 0)
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

        if (result.success && roomID != "")
            await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.OwnedRoom);

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
            dbUser.ownedRoomID ?? "",
            dbUser.ftue ?? ""
        );
    },
}

export default DBUserUtil;
