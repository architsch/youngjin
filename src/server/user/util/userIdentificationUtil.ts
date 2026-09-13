import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import UserTokenUtil from "./userTokenUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import GuestCreationLimitUtil from "./guestCreationLimitUtil";
import BotDetectionUtil from "../../networking/util/botDetectionUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import DevUserSeedUtil from "./devUserSeedUtil";
import DevRuntimeUtil from "../../system/util/devRuntimeUtil";
import { SANDBOX_SINGLE_PLAYER_MODE, TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import AcquisitionSourceUtil from "../../analytics/util/acquisitionSourceUtil";

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
    // Like identifyAnyUser, but self-declared bots get no account (they keep no cookies, so each visit
    // would mint a guest until the cap returned 401s, breaking link previews and indexing). The page
    // renders without a session for them.
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

// admitsAnonymousVisitors: only such routes mint guests and count logins. Member/admin routes are
// never a first visit, and minting there would overwrite the browser's token with a discarded account.
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

        // Browser-level flag so future accounts on this browser skip the tutorial.
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
    // Dev: drop auth cookies from a previous runtime (reset DB). No-op for the current runtime.
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

    // Dev: a sandbox single-player account under a reserved, sanitized name (never an arbitrary id,
    // which would let anyone mint a session for a guessed account). Stored for real because the
    // socket looks users up in the DB; reused per name, with its mode rewritten each visit.
    if (process.env.MODE == "dev" && req.query.sandboxuser)
    {
        const name = String(req.query.sandboxuser).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "0";
        const email = `${name}@${SANDBOX_SINGLE_PLAYER_MODE}.invalid`;
        const userName = `Sandbox-${name}`;

        const existing = await DBSearchUtil.users.withEmail(email);
        if (existing.success && existing.data.length > 0)
        {
            const dbUser = existing.data[0];
            if (dbUser.singlePlayerMode != SANDBOX_SINGLE_PLAYER_MODE)
                await DBUserUtil.setSinglePlayerMode(dbUser.id!, SANDBOX_SINGLE_PLAYER_MODE);
            return new User(dbUser.id, userName, UserTypeEnumMap.Guest, email,
                SANDBOX_SINGLE_PLAYER_MODE);
        }

        const created = await DBUserUtil.createUser(userName, UserTypeEnumMap.Guest, email,
            SANDBOX_SINGLE_PLAYER_MODE);
        if (!created.success || created.data.length == 0)
        {
            LogUtil.logRaw(`Failed to create the sandbox user "${userName}"`, "high", "error");
            return undefined;
        }
        return new User(created.data[0].id, userName, UserTypeEnumMap.Guest, email,
            SANDBOX_SINGLE_PLAYER_MODE);
    }

    const token = req.cookies[CookieUtil.getAuthTokenName()];

    if (token)
    {
        const userId = UserTokenUtil.getUserIdFromToken(token as string);
        if (userId)
        {
            const lookUpResult = await DBUserUtil.lookUpUserById(userId);

            // A failed lookup must not mint a guest: that would overwrite the browser's only token.
            // Fail the request and leave the cookie.
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

    // No resumable account (missing/invalid token or a deleted guest): mint a guest, only on routes that
    // admit anonymous visitors.
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

    // New guests skip the tutorial if this browser already finished it.
    const tutorialFinished = !!req.cookies[CookieUtil.getTutorialFinishedCookieName()];
    const initialSinglePlayerMode = tutorialFinished ? "" : TUTORIAL_SINGLE_PLAYER_MODE;

    // First-touch attribution: captured only here, when creating an account.
    const acquisitionSource = AcquisitionSourceUtil.fromQuery(req.query as Record<string, unknown>);

    const result = await DBUserUtil.createUser(guestName, UserTypeEnumMap.Guest, "", initialSinglePlayerMode,
        acquisitionSource);
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
