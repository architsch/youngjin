import DBSearchUtil from "../../db/util/dbSearchUtil";
import { Request, Response } from "express";
import DBUser from "../../../server/db/types/row/dbUser";
import CookieUtil from "../../networking/util/cookieUtil";
import LogUtil from "../../../shared/system/util/logUtil";

const dev = process.env.MODE == "dev";

const UserSearchUtil =
{
    findExistingUserByUserName: async (userName: string, res?: Response,
        ignoreNotFoundError: boolean = false): Promise<DBUser | null> =>
    {
        const existingUsersResult = await DBSearchUtil.users.withUserName(userName);
        if (!existingUsersResult.success)
        {
            res?.status(500).send(`Internal Server Error`);
            return null;
        }
        if (existingUsersResult.data.length == 0)
        {
            if (!ignoreNotFoundError)
            {
                LogUtil.log("User Not Found", {userName}, "high", "error");
                res?.clearCookie(CookieUtil.getAuthTokenName())
                    .redirect(dev ? "/mypage" : "/");
            }
            return null;
        }
        return existingUsersResult.data[0];
    },
}

export default UserSearchUtil;