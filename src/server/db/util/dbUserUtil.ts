import { UserType, UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import UserGameplayState from "../../user/types/userGameplayState";
import DBCacheUtil from "./dbCacheUtil";

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
            tutorialStep: 0,
            lastRoomID: "",
            lastX: 16,
            lastY: 0,
            lastZ: 16,
            lastDirX: 0,
            lastDirY: 0,
            lastDirZ: 1,
            playerMetadata: {},
            lastLoginAt: Date.now(),
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
        const result = await new DBQuery<DBRow>()
            .update("users")
            .set({
                lastRoomID: gameplayState.lastRoomID,
                lastX: gameplayState.lastX,
                lastY: gameplayState.lastY,
                lastZ: gameplayState.lastZ,
                lastDirX: gameplayState.lastDirX,
                lastDirY: gameplayState.lastDirY,
                lastDirZ: gameplayState.lastDirZ,
                playerMetadata: gameplayState.playerMetadata,
            })
            .where("id", "==", gameplayState.userID)
            .run();
        return result;
    },
    saveMultipleUsersGameplayState: async (gameplayStates: UserGameplayState[]): Promise<void> =>
    {
        if (gameplayStates.length == 0)
            return;
        LogUtil.log("DBUserUtil.saveMultipleUsersGameplayState", {count: gameplayStates.length}, "low", "info");
        const queries = gameplayStates.map(gs =>
            new DBQuery<DBRow>()
                .update("users")
                .set({
                    lastRoomID: gs.lastRoomID,
                    lastX: gs.lastX,
                    lastY: gs.lastY,
                    lastZ: gs.lastZ,
                    lastDirX: gs.lastDirX,
                    lastDirY: gs.lastDirY,
                    lastDirZ: gs.lastDirZ,
                    playerMetadata: gs.playerMetadata,
                })
                .where("id", "==", gs.userID)
        );
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
        // Cache invalidation must NOT happen here ((Reason 1): Cache invalidation in this case will immediately invalidate the cache of a user who is currently logging in, resulting in redundant DB lookups. (Reason 2): 'lastLoginAt' is only used by deleteStaleGuests)
        await new DBQuery<DBRow>()
            .update("users")
            .noInvalidate()
            .set({ lastLoginAt: Date.now() })
            .where("id", "==", userID)
            .run();
    },
    deleteStaleGuests: async (maxAgeMs: number): Promise<number> =>
    {
        const cutoff = Date.now() - maxAgeMs;

        const selectResult = await new DBQuery<DBUser>()
            .select()
            .from("users")
            .where("userType", "==", UserTypeEnumMap.Guest)
            .where("lastLoginAt", "<", cutoff)
            .run();

        if (!selectResult.success || selectResult.data.length === 0)
            return 0;

        for (const doc of selectResult.data)
            if (doc.id) DBCacheUtil.invalidate("users", doc.id);

        await new DBQuery<DBRow>()
            .delete()
            .from("users")
            .where("userType", "==", UserTypeEnumMap.Guest)
            .where("lastLoginAt", "<", cutoff)
            .run();

        return selectResult.data.length;
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
