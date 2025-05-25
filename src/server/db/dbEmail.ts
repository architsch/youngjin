import db from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const dbEmail =
{
    verifications: {
        selectByEmail: async (email: string, res?: Response): Promise<emailVerification[]> =>
        {
            return await db.makeQuery<emailVerification>(
                "SELECT * FROM emailVerifications WHERE email = ?;",
                [email]
            ).run(res);
        },
        insert: async (email: string, verificationCode: string, expirationTime: number,
            res?: Response): Promise<void> =>
        {
            await db.makeQuery<any>(
                "INSERT INTO emailVerifications (email, verificationCode, expirationTime) VALUES (?, ?, ?);",
                [email, verificationCode, expirationTime.toString()]
            ).run(res);
        },
        updateExpirationTime: async (email: string, newExpirationTime: number,
            res?: Response): Promise<void> =>
        {
            await db.makeQuery<any>(
                "UPDATE emailVerifications SET expirationTime = ? WHERE email = ?;",
                [newExpirationTime.toString(), email]
            ).run(res);
        },
        deleteExpired: async (currTime: number, res?: Response): Promise<void> =>
        {
            await db.makeQuery<any>(
                "DELETE FROM emailVerifications WHERE expirationTime < ?;",
                [currTime.toString()]
            ).run(res);
        },
    },
}

export default dbEmail;