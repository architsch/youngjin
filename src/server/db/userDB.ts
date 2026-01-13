import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const UserDB =
{
    createUser: async (userName: string,
        passwordHash: string, res?: Response): Promise<boolean> =>
    {
        const result = await DB.runQuery<void>(
            "INSERT INTO users (userName, userType, passwordHash) VALUES (?, ?, ?);",
            [userName, "member", passwordHash], res, "UserDB.createUser");
        
        return result.success;
    },
}

export default UserDB;