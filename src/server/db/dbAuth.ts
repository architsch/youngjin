import db from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const dbAuth =
{
    registerNewUser: async (userName: string,
        passwordHash: string, email: string, res?: Response): Promise<user[]> =>
    {
        return await db.makeQuery<user>(
            "INSERT INTO users (userName, passwordHash, email) VALUES (?, ?, ?);",
            [userName, passwordHash, email]
        ).run(res);
    },
}

export default dbAuth;