import { UserType, UserTypeEnumMap } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import UserGameplayState from "../../user/types/userGameplayState";
import DBUserCacheUtil from "./dbUserCacheUtil";

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
        const cached = DBUserCacheUtil.get(userID);
        if (cached) return cached;

        LogUtil.log("DBUserUtil.findUserById", {userID}, "low", "info");
        const result = await new DBQuery<DBUser>()
            .select()
            .from("users")
            .where("id", "==", userID)
            .run();
        if (!result.success || result.data.length == 0)
            return null;

        DBUserCacheUtil.set(userID, result.data[0]);
        return result.data[0];
    },
    setUserTutorialStep: async (userID: string, tutorialStep: number): Promise<DBQueryResponse<DBRow>> =>
    {
        DBUserCacheUtil.invalidate(userID);
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
        DBUserCacheUtil.invalidate(gameplayState.userID);
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
            })
            .where("id", "==", gameplayState.userID)
            .run();
        return result;
    },
    saveMultipleUsersGameplayState: async (gameplayStates: UserGameplayState[]): Promise<void> =>
    {
        if (gameplayStates.length == 0)
            return;
        for (const gs of gameplayStates)
            DBUserCacheUtil.invalidate(gs.userID);
        LogUtil.log("DBUserUtil.saveMultipleUsersGameplayState", {count: gameplayStates.length}, "low", "info");
        const db = await FirebaseUtil.getDB();
        const batchSize = 500; // Firestore batch limit
        for (let i = 0; i < gameplayStates.length; i += batchSize)
        {
            const batch = db.batch();
            const chunk = gameplayStates.slice(i, i + batchSize);
            for (const entry of chunk)
            {
                const docRef = db.collection("users").doc(entry.userID);
                batch.update(docRef, {
                    lastRoomID: entry.lastRoomID,
                    lastX: entry.lastX,
                    lastY: entry.lastY,
                    lastZ: entry.lastZ,
                    lastDirX: entry.lastDirX,
                    lastDirY: entry.lastDirY,
                    lastDirZ: entry.lastDirZ,
                });
            }
            await batch.commit();
        }
    },
    setUserLastRoomID: async (userID: string, lastRoomID: string): Promise<DBQueryResponse<DBRow>> =>
    {
        DBUserCacheUtil.invalidate(userID);
        LogUtil.log("DBUserUtil.setUserLastRoomID", {userID, lastRoomID}, "low", "info");
        const result = await new DBQuery<DBRow>()
            .update("users")
            .set({ lastRoomID })
            .where("id", "==", userID)
            .run();
        return result;
    },
    upgradeGuestToMember: async (userID: string, userName: string, email: string): Promise<DBQueryResponse<DBRow>> =>
    {
        DBUserCacheUtil.invalidate(userID);
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
        // No cache invalidation should happen here (And it doesn't have to because 'lastLoginAt' is only used by deleteStaleGuests)
        const db = await FirebaseUtil.getDB();
        await db.collection("users").doc(userID).update({ lastLoginAt: Date.now() });
    },
    deleteStaleGuests: async (maxAgeMs: number): Promise<number> =>
    {
        const cutoff = Date.now() - maxAgeMs;
        const db = await FirebaseUtil.getDB();
        const snapshot = await db.collection("users")
            .where("userType", "==", UserTypeEnumMap.Guest)
            .where("lastLoginAt", "<", cutoff)
            .get();

        if (snapshot.empty)
            return 0;

        for (const doc of snapshot.docs)
            DBUserCacheUtil.invalidate(doc.id);

        let deleted = 0;
        const docs = snapshot.docs;
        const batchSize = 500;
        for (let i = 0; i < docs.length; i += batchSize)
        {
            const batch = db.batch();
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deleted += chunk.length;
        }
        return deleted;
    },
    deleteUser: async (userID: string): Promise<DBQueryResponse<DBRow>> =>
    {
        DBUserCacheUtil.invalidate(userID);
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
            dbUser.lastDirZ ?? 1
        );
    },
}

export default DBUserUtil;
