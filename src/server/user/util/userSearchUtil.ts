import SearchDB from "../../db/searchDB";
import ServerLogUtil from "../../networking/util/serverLogUtil";
import dotenv from "dotenv";
import { Request, Response } from "express";
import SQLUser from "../../../shared/db/types/sqlUser";
import CookieUtil from "../../networking/util/cookieUtil";
dotenv.config();

const UserSearchUtil =
{
    findExistingUserByUserName: async (userName: string, res?: Response): Promise<SQLUser | null> =>
    {
        const existingUsersResult = await SearchDB.users.withUserName(userName);
        if (!existingUsersResult.success)
        {
            res?.status(500).send(`Internal Server Error`);
            return null;
        }
        if (existingUsersResult.data.length == 0)
        {
            ServerLogUtil.log("User Not Found", {userName}, "high", "pink");
            res?.clearCookie(CookieUtil.getAuthTokenName())
                .status(404)
                .send(`There is no account with userName "${userName}".`);
            return null;
        }
        return existingUsersResult.data[0];
    }
}

export default UserSearchUtil;