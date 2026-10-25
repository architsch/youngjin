import crypto from "crypto";
import { Request, Response } from "express";
import UserTokenUtil from "./userTokenUtil";
import DevOAuthUtil from "./devOAuthUtil";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import { HELPER_AGENT_NAME, USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";
import SignInProviderNameMap from "../../../shared/user/maps/signInProviderNameMap";
import RoomIdUtil from "../../../shared/room/util/roomIdUtil";
import AddressUtil from "../../networking/util/addressUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import SignInProvider from "../types/signInProvider/signInProvider";

const USER_NAME_BASE_MAX_LENGTH = 24;

// A person's sign-in through a provider (see SignInProviderMap): the trip there, and the callback that signs the
// browser into the account its verified email belongs to, or makes one of the browser's guest. No account is given a
// room of its own (only agents have rooms), and the person comes back to the room they signed in from.
const UserSignInUtil =
{
    login: async (provider: SignInProvider, req: Request, res: Response): Promise<void> =>
    {
        const returnRoomID = (typeof req.query.roomID == "string" && RoomIdUtil.isRoomID(req.query.roomID))
            ? req.query.roomID : "";
        // Dev mode fakes the provider (see DevOAuthUtil).
        if (process.env.MODE == "dev")
        {
            await DevOAuthUtil.fakeSignIn(req, res, returnRoomID);
            return;
        }
        if (!provider.isConfigured())
        {
            res.status(404).send("This way of signing in isn't available.");
            return;
        }
        // Only the browser holding this state may finish the sign-in, so nobody can sign a visitor in with a code of
        // their own (login CSRF).
        const state = crypto.randomUUID();
        res.cookie(CookieUtil.getOAuthStateCookieName(), state, CookieUtil.getOAuthStateCookieOptions());
        res.cookie(CookieUtil.getOAuthReturnRoomCookieName(), returnRoomID, CookieUtil.getOAuthStateCookieOptions());
        res.redirect(provider.getAuthorizeURL(state, getRedirectURL(provider)));
    },
    loginCallback: async (provider: SignInProvider, req: Request, res: Response): Promise<void> =>
    {
        const providerName = SignInProviderNameMap[provider.id];
        try
        {
            const query = req.query;
            // A state is good for one callback, whatever its outcome (see login).
            const expectedState = req.cookies[CookieUtil.getOAuthStateCookieName()];
            const returnRoomID = req.cookies[CookieUtil.getOAuthReturnRoomCookieName()];
            for (const cookieName of [CookieUtil.getOAuthStateCookieName(), CookieUtil.getOAuthReturnRoomCookieName()])
                res.clearCookie(cookieName, CookieUtil.toClearOptions(CookieUtil.getOAuthStateCookieOptions()));
            if (!expectedState || query.state !== expectedState)
            {
                res.status(400).send(`${providerName} OAuth state mismatch. Please sign in again.`);
                return;
            }
            if (typeof query.code != "string" || !query.code)
            {
                res.status(400).send(`${providerName} OAuth code not found.`);
                return;
            }

            const identity = await provider.fetchIdentity(query.code, getRedirectURL(provider));
            if ("error" in identity)
            {
                res.status(identity.status).send(identity.error);
                return;
            }
            if (!await signIn(identity.email, identity.preferredName, req, res))
                return;

            // Whichever account the browser now holds, its player arrives back in the room it signed in from.
            res.redirect((typeof returnRoomID == "string" && RoomIdUtil.isRoomID(returnRoomID))
                ? `/${returnRoomID}` : "/");
        }
        catch (err)
        {
            LogUtil.log("Login Error", {err, provider: provider.id}, "high", "error");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
}

function getRedirectURL(provider: SignInProvider): string
{
    return `${AddressUtil.getEnvDynamicURL()}/${USER_API_ROUTE_PATH}/login_${provider.id}_callback`;
}

// Signs the browser into the account with this email, or makes one: of the browser's guest, if it holds one, else
// anew. False once an error has been sent.
async function signIn(email: string, preferredName: string, req: Request, res: Response): Promise<boolean>
{
    const existingUsersResult = await DBSearchUtil.users.withEmail(email);
    if (!existingUsersResult.success)
    {
        res.status(500).send(`Internal Server Error`);
        return false;
    }

    // The browser's current account, only if it's a guest: a guest may be upgraded (new email) or discarded (existing
    // account). A member signing in as someone else is left untouched.
    const currentToken = req.cookies[CookieUtil.getAuthTokenName()];
    const currentUserID = currentToken ? UserTokenUtil.getUserIdFromToken(currentToken) : undefined;
    const currentUser = currentUserID ? await DBUserUtil.findUserById(currentUserID) : null;
    const guestId = currentUser?.userType == UserTypeEnumMap.Guest ? currentUserID : undefined;

    if (existingUsersResult.data.length > 0) // previously registered user
    {
        const dbUser = existingUsersResult.data[0];
        // Delete the orphaned guest document (if different from existing account)
        if (guestId && guestId !== dbUser.id)
            DBUserUtil.deleteUser(guestId); // fire-and-forget
        // Sign JWT with the existing account's document ID
        UserTokenUtil.addTokenForUserId(dbUser.id!, req, res);
        return true;
    }

    // Find an available userName
    const userNameBase = toUserNameBase(preferredName);
    let userName = userNameBase;
    let nameFound = false;
    let numNameCopies = 0;
    while (!nameFound && ++numNameCopies <= 9)
    {
        if (numNameCopies >= 2)
            userName = `${userNameBase}#${numNameCopies}`;
        const nameConflictingUsersResult = await DBSearchUtil.users.withUserName(userName);
        if (!nameConflictingUsersResult.success)
        {
            res.status(500).send(`Internal Server Error`);
            return false;
        }
        if (nameConflictingUsersResult.data.length == 0)
            nameFound = true;
    }
    if (!nameFound)
    {
        res.status(500).send(`Username "${userNameBase}" is used too many times.`);
        return false;
    }

    if (guestId)
    {
        // Upgrade the existing guest document in-place (preserves gameplay state); the JWT stays the same.
        await DBUserUtil.upgradeGuestToMember(guestId, userName, email);
        return true;
    }
    // No guest to upgrade — create a new member document
    const result = await DBUserUtil.createUser(userName, UserTypeEnumMap.Member, email);
    if (!result.success)
    {
        res.status(500).send(`Internal Server Error (during registration)`);
        return false;
    }
    UserTokenUtil.addTokenForUserId(result.data[0].id, req, res);
    return true;
}

// The provider's name kept to the characters names hold (no spaces: a user travels to the browser as space-separated
// fields), never one that passes for a guest's or a helper's.
function toUserNameBase(preferredName: string): string
{
    const cleaned = preferredName.replace(/[^A-Za-z0-9_.-]/g, "").replace(/^[^A-Za-z0-9]+/, "")
        .slice(0, USER_NAME_BASE_MAX_LENGTH);
    const lowerCased = cleaned.toLowerCase();
    if (cleaned.length < 3 || lowerCased.startsWith("guest-") || lowerCased == HELPER_AGENT_NAME.toLowerCase())
        return `member-${cleaned}`.slice(0, USER_NAME_BASE_MAX_LENGTH);
    return cleaned;
}

export default UserSignInUtil;
