import ServerLogUtil from "../../networking/util/serverLogUtil";
import dotenv from "dotenv";
import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import UserTokenUtil from "./userTokenUtil";
import UserSearchUtil from "./userSearchUtil";
import CookieUtil from "../../networking/util/cookieUtil";
dotenv.config();

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
    const user = getUserFromReq(req);
    if (user)
    {
        if (!passCondition(user))
        {
            ServerLogUtil.log("User doesn't satisfy the pass-condition.", { user }, "high", "pink");
            res.status(403).send("User doesn't satisfy the pass-condition.");
            return false;
        }

        switch (user.userType)
        {
            case UserTypeEnumMap.Admin:
            case UserTypeEnumMap.Member:
                try {
                    const sqlUser = await UserSearchUtil.findExistingUserByUserName(user.userName, res); // Re-fetch the user object (because it could've been modified)
                    if (!sqlUser)
                        return false;
                    const latestUser = User.fromSQL(sqlUser);
                    await UserTokenUtil.addTokenToUser(latestUser, req, res);
                    (req as any).userString = latestUser.toString();
                    next();
                    return true;
                }
                catch (err) {
                    ServerLogUtil.log("Failed to process a registered user", {err}, "high", "pink");
                    res.status(401).send(`Failed to process a registered user (error: ${err})`);
                    return false;
                }
            case UserTypeEnumMap.Guest:
                try {
                    await UserTokenUtil.addTokenToUser(user, req, res);
                    (req as any).userString = user.toString();
                    next();
                    return true;
                }
                catch (err) {
                    ServerLogUtil.log("Failed to add token (guest)", {err}, "high", "pink");
                    res.status(401).send(`Failed to add token (error: ${err})`);
                    return false;
                }
            default:
                ServerLogUtil.log(`Unknown user type`, { userType: user.userType }, "high", "pink");
                res.status(500).send(`Unknown user type :: ${user.userType} (user: ${user.toString()})`);
                return false;
        }
    }
    else
    {
        ServerLogUtil.logRaw("Failed to identify the user", "high", "pink");
        res.status(401).send("Failed to identify the user");
        return false;
    }
}

function getUserFromReq(req: Request): User | undefined
{
    let user: User | undefined = undefined;
    const token = req.cookies[CookieUtil.getAuthTokenName()];

    if (token)
        user = UserTokenUtil.getUserFromToken(token as string); // Try to fetch the previously authenticated user (if there is one).

    if (!user)
    {
        // If no previously authenticated user is found,
        // just generate a random user and make a guest-token for it.
        // We will keep using this guest-token until the client either creates his/her own account or logs in.

        const uniqueInt = ((Math.floor(Date.now() / 1000) - 1768000000) * 10) + cyclicCounter;
        cyclicCounter = (cyclicCounter + 1) % 10;
        const uniqueHex = uniqueInt.toString(16);
        const guestName = `Guest-${uniqueHex}`;
        user = new User(0, guestName, UserTypeEnumMap.Guest, "", 0);
    }
    return user;
}

export default UserIdentificationUtil;