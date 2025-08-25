import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const AuthDB =
{
    registerNewUser: async (userName: string,
        passwordHash: string, email: string, res?: Response): Promise<User[]> =>
    {
        return await DB.makeQuery<User>(
            "INSERT INTO users (userName, userType, passwordHash, email) VALUES (?, ?, ?, ?);",
            [userName, "member", passwordHash, email]
        ).run(res, "AuthDB.registerNewUser");
    },
}

export default AuthDB;