import DB from "./db";
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const EmailDB =
{
    verifications: {
        selectByEmail: async (email: string, res?: Response): Promise<EmailVerification[]> =>
        {
            return await DB.makeQuery<EmailVerification>(
                "SELECT * FROM emailVerifications WHERE email = ?;",
                [email]
            ).run(res, "EmailDB.verifications.selectByEmail");
        },
        insert: async (email: string, verificationCode: string, expirationTime: number,
            res?: Response): Promise<void> =>
        {
            await DB.makeQuery<any>(
                "INSERT INTO emailVerifications (email, verificationCode, expirationTime) VALUES (?, ?, ?);",
                [email, verificationCode, expirationTime.toString()]
            ).run(res, "EmailDB.verifications.insert");
        },
        updateExpirationTime: async (email: string, newExpirationTime: number,
            res?: Response): Promise<void> =>
        {
            await DB.makeQuery<any>(
                "UPDATE emailVerifications SET expirationTime = ? WHERE email = ?;",
                [newExpirationTime.toString(), email]
            ).run(res, "EmailDB.verifications.updateExpirationTime");
        },
        deleteExpired: async (currTime: number, res?: Response): Promise<void> =>
        {
            await DB.makeQuery<any>(
                "DELETE FROM emailVerifications WHERE expirationTime < ?;",
                [currTime.toString()]
            ).run(res, "EmailDB.verifications.deleteExpired");
        },
    },
}

export default EmailDB;