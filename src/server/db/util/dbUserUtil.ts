import { UserType } from "../../../shared/user/types/userType";
import dotenv from "dotenv";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";
import DBUser from "../types/row/dbUser";
import User from "../../../shared/user/types/user";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
dotenv.config();

const DBUserUtil =
{
    createUser: async (userName: string, userType: UserType, passwordHash: string,
        email: string): Promise<boolean> =>
    {
        const user: DBUser = {
            version: DBUserVersionMigration.length,
            userName,
            userType,
            passwordHash,
            email,
            tutorialStep: 0,
        };
        const result = await new DBQuery<DBRow>()
            .insertInto("users")
            .values(user)
            .run();
        
        return result.success;
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