import { UserType } from "../../../shared/user/types/userType";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";

const DBUserUtil =
{
    createUser: async (userName: string, userType: UserType, passwordHash: string,
        email: string): Promise<DBQueryResponse<{id: string}>> =>
    {
        LogUtil.log("DBUserUtil.createUser", {userName, userType, passwordHash, email}, "low", "info");
        const user: DBUser = {
            version: DBUserVersionMigration.length,
            userName,
            userType,
            passwordHash,
            email,
            tutorialStep: 0,
        };
        const result = await new DBQuery<{id: string}>()
            .insertInto("users")
            .values(user)
            .run();
        return result;
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
    fromDBType(dbUser: DBUser): User
    {
        return new User(
            dbUser.id,
            dbUser.userName,
            dbUser.userType,
            dbUser.email,
            dbUser.tutorialStep
        );
    },
}

export default DBUserUtil;