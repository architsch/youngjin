import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import UserTokenUtil from "./userTokenUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import DBUserUtil from "../../db/util/dbUserUtil";
import GuestCreationLimitUtil from "./guestCreationLimitUtil";
import BotDetectionUtil from "../../networking/util/botDetectionUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import DevUserSeedUtil from "./devUserSeedUtil";
import DevRuntimeUtil from "../../system/util/devRuntimeUtil";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";

let cyclicCounter = 0;

const UserIdentificationUtil =
{
    identifyAdmin: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res, user => user.userType == UserTypeEnumMap.Admin, next, false);
    },
    identifyRegisteredUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res,
            user => user.userType == UserTypeEnumMap.Admin ||
                user.userType == UserTypeEnumMap.Member,
            next, false);
    },
    identifyAnyUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await identifyUserFromReq(req, res, _ => true, next, true);
    },
    // As above, except that a self-declared crawler or link-preview fetcher is passed straight
    // through without an account being made for it. Such a client keeps no cookies, so every one
    // of its visits would otherwise mint a guest — and once a run of them exhausted the guest
    // allowance, the ones that followed would be answered with a 401. That answer is the expensive
    // part: it is what turns a link posted into a chat window into a card that will not load, and
    // what tells a search engine that the site's own front door is unavailable. The page renders
    // for them without a session instead (see the game page's no-session branch).
    identifyAnyUserUnlessBot: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        if (BotDetectionUtil.isBot(req.headers["user-agent"]))
        {
            next();
            return;
        }
        await UserIdentificationUtil.identifyAnyUser(req, res, next);
    },
}

// `admitsAnonymousVisitors` says whether this route is one a visitor may arrive at without an
// account yet. Both of the things that follow from that are its business: only such a route mints
// a guest for a visitor who has none, and only such a route counts the arrival as a login. A route
// reserved for admins or members is never a person's first contact with the site, so minting an
// account there produces one that is thrown away in the same breath by the pass-condition below —
// while still handing the browser the new account's token, over the top of whatever it was holding.
async function identifyUserFromReq(req: Request, res: Response,
    passCondition: (user: User) => Boolean, next: () => void, admitsAnonymousVisitors: boolean): Promise<boolean>
{
    try
    {
        const user = await getUserFromReq(req, res, admitsAnonymousVisitors);
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

        // Remember, at the browser level, that this user has already finished (or skipped) the
        // tutorial, so any brand-new account later created on this browser (e.g. the guest
        // spawned after this user signs out) skips the tutorial instead of replaying it.
        if (user.singlePlayerMode == "")
            res.cookie(CookieUtil.getTutorialFinishedCookieName(), "1", CookieUtil.getTutorialFinishedCookieOptions());

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

async function getUserFromReq(req: Request, res: Response, admitsAnonymousVisitors: boolean): Promise<User | undefined>
{
    // Dev mode: drop auth cookies left over from a previous DevRunner runtime (whose emulated DB
    // has since been reset), so a freshly started runtime doesn't resurrect a now-nonexistent user
    // or replay browser-scoped state. A no-op for cookies belonging to the current runtime, so it
    // does not disturb hot reloads. Runs before any cookie/devuser resolution below.
    if (process.env.MODE == "dev")
        DevRuntimeUtil.invalidateStaleCookies(req, res);

    // Dev mode: allow switching to a seeded dev user via ?devuser=N query param
    if (process.env.MODE == "dev" && req.query.devuser)
    {
        const index = parseInt(req.query.devuser as string);
        if (!isNaN(index))
        {
            const devUserId = DevUserSeedUtil.getUserIdByIndex(index);
            if (devUserId)
            {
                const dbUser = await DBUserUtil.findUserById(devUserId);
                if (dbUser)
                {
                    UserTokenUtil.addTokenForUserId(devUserId, req, res);
                    return DBUserUtil.fromDBType(dbUser);
                }
            }
        }
    }

    const token = req.cookies[CookieUtil.getAuthTokenName()];

    if (token)
    {
        const userId = UserTokenUtil.getUserIdFromToken(token as string);
        if (userId)
        {
            const lookUpResult = await DBUserUtil.lookUpUserById(userId);

            // A lookup that *failed* says nothing about whether this account exists, so it must
            // not be answered by minting a guest: doing so overwrites the browser's only copy of
            // this user's token with the new guest's, and the account — with everything built
            // under it — becomes unreachable forever. Failing the request instead leaves the
            // cookie alone, so the next attempt finds the user exactly where it left them.
            if (!lookUpResult.success)
            {
                LogUtil.log("User lookup failed for a valid token — refusing to replace the session",
                    { userId }, "high", "error");
                return undefined;
            }

            const dbUser = lookUpResult.data[0];
            if (dbUser)
            {
                if (admitsAnonymousVisitors)
                    DBUserUtil.updateLastLogin(userId, dbUser.lastLoginAt);
                return DBUserUtil.fromDBType(dbUser);
            }
        }
    }

    // The token is missing, unreadable, or names an account that is genuinely gone (a guest the
    // stale-account cleanup has since removed). Whichever it is, there is nobody to resume, so a
    // guest is minted — but only where an anonymous visitor is somebody this route serves.
    if (!admitsAnonymousVisitors)
        return undefined;

    const ip = req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    if (!GuestCreationLimitUtil.allowGuestCreation(ip, userAgent))
    {
        return undefined;
    }

    const uniqueInt = ((Math.floor(Date.now() / 1000) - 1768000000) * 10) + cyclicCounter;
    cyclicCounter = (cyclicCounter + 1) % 10;
    const uniqueHex = uniqueInt.toString(16);
    const guestName = `Guest-${uniqueHex}`;

    // If this browser has already finished the tutorial, the new guest skips it (mode "");
    // otherwise it starts in the tutorial like any first-time visitor.
    const tutorialFinished = !!req.cookies[CookieUtil.getTutorialFinishedCookieName()];
    const initialSinglePlayerMode = tutorialFinished ? "" : TUTORIAL_SINGLE_PLAYER_MODE;

    const result = await DBUserUtil.createUser(guestName, UserTypeEnumMap.Guest, "", initialSinglePlayerMode);
    if (!result.success || result.data.length == 0)
    {
        LogUtil.logRaw("Failed to create guest user in Firestore", "high", "error");
        return undefined;
    }
    const guestId = result.data[0].id;

    UserTokenUtil.addTokenForUserId(guestId, req, res);

    return new User(guestId, guestName, UserTypeEnumMap.Guest, "", initialSinglePlayerMode);
}

export default UserIdentificationUtil;
