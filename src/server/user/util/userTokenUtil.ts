import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import CookieUtil from "../../networking/util/cookieUtil";
import LogUtil from "../../../shared/system/util/logUtil";

const UserTokenUtil =
{
    getUserIdFromToken: (token: string): string | undefined =>
    {
        try {
            const userId = jwt.verify(token as string, process.env.JWT_SECRET_KEY as string);
            if (userId && typeof userId === "string" && userId.length > 0)
            {
                return userId;
            }
            else
            {
                LogUtil.log("User ID not found in the given token.", { tokenLength: (token as string).length }, "high", "warn");
                return undefined;
            }
        }
        catch (err) {
            LogUtil.log("Token Verification Failed", {err}, "high", "error");
            return undefined;
        }
    },
    addTokenForUserId: (userId: string, req: Request, res?: Response): void =>
    {
        const token = jwt.sign(
            userId,
            process.env.JWT_SECRET_KEY as string,
        );

        res?.cookie(CookieUtil.getAuthTokenName(), token,
            CookieUtil.getAuthTokenCookieOptions()).status(201);
    },
    clearToken: (req: Request, res: Response): void =>
    {
        res.clearCookie(CookieUtil.getAuthTokenName(),
            CookieUtil.getAuthTokenCookieOptions()).status(200);
    },
}

export default UserTokenUtil;
