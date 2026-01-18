import ServerLogUtil from "../../networking/util/serverLogUtil";
import dotenv from "dotenv";
import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import jwt from "jsonwebtoken";
import CookieUtil from "../../networking/util/cookieUtil";
dotenv.config();

const dev = process.env.MODE == "dev";

const UserTokenUtil =
{
    getUserFromToken: (token: string): User | undefined =>
    {
        try {
            const userString = jwt.verify(token as string, process.env.JWT_SECRET_KEY as string);
            if (userString)
            {
                return User.fromString(userString as string);
            }
            else
            {
                ServerLogUtil.log("User is not found in the given token.", { tokenLength: (token as string).length }, "high", "yellow");
                return undefined;
            }
        }
        catch (err) {
            ServerLogUtil.log("Token Verification Failed", {err}, "high", "pink");
            return undefined;
        }
    },
    addTokenToUser: async (user: User, req: Request, res?: Response): Promise<void> =>
    {
        const token = jwt.sign(
            user.toString(),
            process.env.JWT_SECRET_KEY as string,
        );

        res?.cookie(CookieUtil.getAuthTokenName(), token, {
            secure: dev ? false : true,
            httpOnly: true,
            sameSite: dev ? "lax" : "strict",
            maxAge: 3155692600000, // 100 years
        }).status(201);
    },
    clearTokenFromUser: (req: Request, res: Response): void =>
    {
        res.clearCookie(CookieUtil.getAuthTokenName()).status(200);
    },
}

export default UserTokenUtil;