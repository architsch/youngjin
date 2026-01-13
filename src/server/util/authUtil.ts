import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import SearchDB from "../db/searchDB";
import UserDB from "../db/userDB";
import DebugUtil from "./debugUtil";
import dotenv from "dotenv";
import { Request, Response } from "express";
import User from "../../shared/auth/types/user";
import { AUTH_TOKEN_NAME } from "../../shared/system/constants";
import AuthInputValidator from "../../shared/auth/util/authInputValidator";
import { localize } from "../../shared/localization/util/locUtil";
dotenv.config();

const dev = process.env.MODE == "dev";
let cyclicCounter = 0;

const AuthUtil =
{
    register: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!validateUserNameAndPassword(req, res))
                return;

            let existingUsers = await SearchDB.users.withUserName(req.body.userName, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
            {
                DebugUtil.log("UserName already exists", {userName: req.body.userName, existingUser: existingUsers[0]}, "high", "pink");
                res.status(403).send(`User "${req.body.userName}" already exists.`);
                return;
            }
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            await UserDB.createUser(req.body.userName, passwordHash, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            await addTokenForRegisteredUser(req.body.userName, res);
        }
        catch (err)
        {
            DebugUtil.log("User Registration Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to register the user (${err}).`);
        }
    },
    login: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!validateUserNameAndPassword(req, res))
                return;

            const user = await findExistingUserByUserName(req.body.userName, res);
            if (!user)
                return;

            const validPassword = await bcrypt.compare(req.body.password, user.passwordHash);

            if (!validPassword)
            {
                DebugUtil.log("Wrong password", {passwordEntered: (dev ? req.body.password : "(HIDDEN)"), passwordHash: user.passwordHash}, "high", "pink");
                res.status(401).send("Wrong password.");
                return;
            }

            await addTokenForRegisteredUser(req.body.userName, res);
        }
        catch (err)
        {
            DebugUtil.log("Login Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
    getUserFromToken: (token: string): User | null =>
    {
        return getUserFromToken(token);
    },
    clearToken: (req: Request, res: Response): void =>
    {
        res.clearCookie(AUTH_TOKEN_NAME).status(200);
    },
    authenticateAdmin: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await authenticate(req, res, user => user.userType == "admin", next);
    },
    authenticateRegisteredUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await authenticate(req, res, user => user.userType == "admin" || user.userType == "member", next);
    },
    authenticateAnyUser: async (req: Request, res: Response, next: () => void): Promise<void> =>
    {
        await authenticate(req, res, _ => true, next);
    }
}

async function authenticate(req: Request, res: Response,
    passCondition: (user: User) => Boolean, next: () => void): Promise<boolean>
{
    const user = getUserFromReq(req);
    if (user)
    {
        if (!passCondition(user))
        {
            DebugUtil.log("User doesn't satisfy the pass-condition.", { user }, "high", "pink");
            res.status(403).send("User doesn't satisfy the pass-condition.");
            return false;
        }

        switch (user.userType)
        {
            case "admin":
            case "member":
                try {
                    await addTokenForRegisteredUser(user.userName, res); // refresh the token
                    (req as any).user = user;
                    next();
                    return true;
                }
                catch (err) {
                    DebugUtil.log("Failed to add token (registered user)", {err}, "high", "pink");
                    res.status(401).send(`Failed to add token (error: ${err})`);
                    return false;
                }
            case "guest":
                try {
                    await addTokenForGuest(user, res); // refresh the token
                    (req as any).user = user;
                    next();
                    return true;
                }
                catch (err) {
                    DebugUtil.log("Failed to add token (guest)", {err}, "high", "pink");
                    res.status(401).send(`Failed to add token (error: ${err})`);
                    return false;
                }
            default:
                DebugUtil.log(`Unknown user type`, { userType: user.userType }, "high", "pink");
                res.status(500).send(`Unknown user type :: ${user.userType}`);
                return false;
        }
    }
    else
    {
        DebugUtil.logRaw("Authentication Failed", "high", "pink");
        res.status(401).send("Authentication Failed");
        return false;
    }
}

// Returns NULL if the token exists but the authentication failed.
// Returns a registered user (admin or member) if the token exists and the authentication succeeded.
// Returns a guest user if the token doesn't exist.
function getUserFromReq(req: Request): User | null
{
    const token = req.cookies[AUTH_TOKEN_NAME];
    if (token) // Token exists? It means the client has authenticated before.
    {
        // If the token is valid and not expired, the existing user (member) will be returned.
        // Otherwise NULL will be returned, in which case the client should be asked to re-authenticate (i.e. log in).
        return getUserFromToken(token as string);
    }
    else // Token doesn't exist? It means the client is visiting this web-app the very first time.
    {
        // Since this is the first-time visit, just generate a random user and make a guest-token for it.
        // We will keep using this guest-token until the client creates his/her own account.

        const uniqueInt = ((Math.floor(Date.now() / 1000) - 1768000000) * 10) + cyclicCounter;
        cyclicCounter = (cyclicCounter + 1) % 10;
        const uniqueHex = uniqueInt.toString(16);
        const guestName = `Guest-${uniqueHex}`;
        return { userID: 0, userName: guestName, userType: "guest", passwordHash: "NO_PASSWORD" };
    }
}

function getUserFromToken(token: string): User | null
{
    try {
        const user = jwt.verify(token as string, process.env.JWT_SECRET_KEY as string);
        if (user)
        {
            return user as User;
        }
        else
        {
            DebugUtil.log("User is not found in the given token.", { tokenLength: (token as string).length }, "high", "yellow");
            return null;
        }
    }
    catch (err) {
        DebugUtil.log("Token Verification Failed", {err}, "high", "pink");
        return null;
    }
}

async function addTokenForGuest(guestUser: User, res?: Response): Promise<void>
{
    const token = jwt.sign(
        guestUser,
        process.env.JWT_SECRET_KEY as string,
    );

    res?.cookie(AUTH_TOKEN_NAME, token, {
        secure: dev ? false : true,
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3155692600000, // 100 years
    }).status(201);
}

async function addTokenForRegisteredUser(userName: string, res?: Response): Promise<void>
{
    const user = await findExistingUserByUserName(userName, res); // Re-fetch the user object (because it could've been modified)
    if (!user)
    {
        DebugUtil.log("Failed to add token (user not found)", {userName}, "high");
        res?.status(404).send(`Tried to add token, but there is no account with userName "${userName}".`);
        return;
    }

    const token = jwt.sign(
        user,
        process.env.JWT_SECRET_KEY as string,
    );

    res?.cookie(AUTH_TOKEN_NAME, token, {
        secure: dev ? false : true,
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3155692600000, // 100 years
    }).status(201);
}

async function findExistingUserByUserName(userName: string, res?: Response): Promise<any>
{
    let existingUsers = await SearchDB.users.withUserName(userName, res);
    if (res && (res.statusCode < 200 || res.statusCode >= 300))
        return null;
    if (!existingUsers || existingUsers.length == 0)
    {
        DebugUtil.log("User Not Found", {userName}, "high", "pink");
        res?.clearCookie(AUTH_TOKEN_NAME)
            .status(404)
            .send(`There is no account with userName "${userName}".`);
        return null;
    }
    return existingUsers[0];
}

function validateUserNameAndPassword(req: Request, res: Response): boolean
{
    const userNameError = AuthInputValidator.findErrorInUserName(req.body.userName);
    if (userNameError != null)
    {
        DebugUtil.log("UserName Input Error", {userName: req.body.userName, userNameError}, "high", "pink");
        res.status(400).send(localize(userNameError));
        return false;
    }
    const passwordError = AuthInputValidator.findErrorInPassword(req.body.password);
    if (passwordError != null)
    {
        DebugUtil.log("Password Input Error", {password: (dev ? req.body.password : "(HIDDEN)"), passwordError}, "high", "pink");
        res.status(400).send(localize(passwordError));
        return false;
    }
    return true;
}

export default AuthUtil;