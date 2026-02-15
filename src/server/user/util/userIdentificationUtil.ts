import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import UserTokenUtil from "./userTokenUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import DBUserUtil from "../../db/util/dbUserUtil";
import LogUtil from "../../../shared/system/util/logUtil";

let cyclicCounter = 0;

const UserIdentificationUtil =
{
    identifyAdmin: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res, user => user.userType == UserTypeEnumMap.Admin, next);
    },
    identifyRegisteredUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res,
            user => user.userType == UserTypeEnumMap.Admin ||
                user.userType == UserTypeEnumMap.Member,
            next);
    },
    identifyAnyUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res, _ => true, next);
    },
}

async function identifyUserFromReq(req: Request, res: Response,
    passCondition: (user: User) => Boolean, next: () => void): Promise<boolean>
{
    try
    {
        const user = await getUserFromReq(req, res);
        if (!user)
        {
            LogUtil.logRaw("Failed to identify the user", "high", "error");
            res.status(401).send("Failed to identify the user");
            return false;
        }

        if (!passCondition(user))
        {
            LogUtil.log("User doesn't satisfy the pass-condition.", { user }, "high", "error");
            res.status(403).send("User doesn't satisfy the pass-condition.");
            return false;
        }

        UserTokenUtil.addTokenForUserId(user.id, req, res);
        (req as any).userString = user.toString();
        next();
        return true;
    }
    catch (err)
    {
        LogUtil.log("Failed to identify user", {err}, "high", "error");
        res.status(401).send(`Failed to identify user (error: ${err})`);
        return false;
    }
}

async function getUserFromReq(req: Request, res: Response): Promise<User | undefined>
{
    const token = req.cookies[CookieUtil.getAuthTokenName()];

    if (token)
    {
        const userId = UserTokenUtil.getUserIdFromToken(token as string);
        if (userId)
        {
            const dbUser = await DBUserUtil.findUserById(userId);
            if (dbUser)
            {
                DBUserUtil.updateLastLogin(userId);
                return DBUserUtil.fromDBType(dbUser);
            }
        }
    }

    // No valid token or user not found in DB — create a new guest in Firestore
    const uniqueInt = ((Math.floor(Date.now() / 1000) - 1768000000) * 10) + cyclicCounter;
    cyclicCounter = (cyclicCounter + 1) % 10;
    const uniqueHex = uniqueInt.toString(16);
    const guestName = `Guest-${uniqueHex}`;

    const result = await DBUserUtil.createUser(guestName, UserTypeEnumMap.Guest, "");
    if (!result.success || result.data.length == 0)
    {
        LogUtil.logRaw("Failed to create guest user in Firestore", "high", "error");
        return undefined;
    }
    const guestId = result.data[0].id;

    UserTokenUtil.addTokenForUserId(guestId, req, res);

    return new User(guestId, guestName, UserTypeEnumMap.Guest, "", 0);
}

export default UserIdentificationUtil;
