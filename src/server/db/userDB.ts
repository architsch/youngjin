import { UserType } from "../../shared/user/types/userType";
import DB from "./db";
import dotenv from "dotenv";
dotenv.config();

const UserDB =
{
    createUser: async (userName: string, userType: UserType, passwordHash: string,
        email: string): Promise<boolean> =>
    {
        const result = await DB.runQuery<void>(
            `INSERT INTO users (userName, userType, passwordHash, email, tutorialStep)
            VALUES (?, ?, ?, ?, 0);`,
            [userName, userType, passwordHash, email]);
        
        return result.success;
    },
}

export default UserDB;