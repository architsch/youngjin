import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import envUtil from "./envUtil";
import emailUtil from "./emailUtil";
import dbSearch from "../db/dbSearch";
import dbAuth from "../db/dbAuth";
import textUtil from "../../shared/util/textUtil";
import debugUtil from "./debugUtil";
import dotenv from "dotenv";
import { Request, Response } from "express";
dotenv.config();

const dev = envUtil.isDevMode();

const authUtil =
{
    register: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!authUtil.validateUserNameAndPassword(req, res))
                return;

            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
            {
                debugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high", "pink");
                res.status(400).send(emailError);
                return;
            }

            let existingUsers = await dbSearch.users.withUserName(req.body.userName, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
            {
                debugUtil.log("UserName already exists", {userName: req.body.userName, existingUser: existingUsers[0]}, "high", "pink");
                res.status(403).send(`User "${req.body.userName}" already exists.`);
                return;
            }

            existingUsers = await dbSearch.users.withEmail(req.body.email, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
            {
                debugUtil.log("There is already an account with the same email", {email: req.body.email, existingUser: existingUsers[0]}, "high", "pink");
                res.status(403).send(`There is already an account with the email "${req.body.email}".`);
                return;
            }
    
            await emailUtil.endEmailVerification(req, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            await dbAuth.registerNewUser(req.body.userName, passwordHash, req.body.email, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            await authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            debugUtil.log("User Registration Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to register the user (${err}).`);
        }
    },
    login: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!authUtil.validateUserNameAndPassword(req, res))
                return;

            const user = await authUtil.findExistingUserByUserName(req.body.userName, res);
            if (!user)
                return;

            const validPassword = await bcrypt.compare(req.body.password, user.passwordHash);

            if (!validPassword)
            {
                debugUtil.log("Wrong password", {passwordEntered: (dev ? req.body.password : "(HIDDEN)"), passwordHash: user.passwordHash}, "high", "pink");
                res.status(401).send("Wrong password.");
                return;
            }

            await authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            debugUtil.log("Login Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
    validateUserNameAndPassword: (req: Request, res: Response): boolean => {
        const userNameError = textUtil.findErrorInUserName(req.body.userName);
        if (userNameError != null)
        {
            debugUtil.log("UserName Input Error", {userName: req.body.userName, userNameError}, "high", "pink");
            res.status(400).send(userNameError);
            return false;
        }
        const passwordError = textUtil.findErrorInPassword(req.body.password);
        if (passwordError != null)
        {
            debugUtil.log("Password Input Error", {password: (dev ? req.body.password : "(HIDDEN)"), passwordError}, "high", "pink");
            res.status(400).send(passwordError);
            return false;
        }
        return true;
    },
    findExistingUserByUserName: async (userName: string, res?: Response): Promise<any> => {
        let existingUsers = await dbSearch.users.withUserName(userName, res);
        if (res && (res.statusCode < 200 || res.statusCode >= 300))
            return null;
        if (!existingUsers || existingUsers.length == 0)
        {
            debugUtil.log("User Not Found", {userName}, "high", "pink");
            res?.status(404).send(`There is no account with userName "${userName}".`);
            return null;
        }
        return existingUsers[0];
    },
    getUserFromReqToken: (req: Request, optional: boolean = false): user | null => {
        const token = req.cookies["thingspool_token"];
        if (!token)
        {
            if (!optional)
                debugUtil.log("Token Not Found in Request", {}, "high", "pink");
            return null;
        }
        return authUtil.getUserFromToken(token as string);
    },
    getUserFromToken: (token: string): user | null => {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
            if (!user)
            {
                debugUtil.log("User is not found in the given token.", {token}, "high", "pink");
                return null;
            }
            return user as user;
        }
        catch (err) {
            debugUtil.log("Token Verification Failed", {err}, "high", "pink");
            return null;
        }
    },
    addToken: async (userName: string, res?: Response): Promise<void> => {
        const user = await authUtil.findExistingUserByUserName(userName, res); // Re-fetch the user object (because it could've been modified)
        if (!user)
        {
            debugUtil.log("AddToken Tried, User Not Found", {userName}, "high");
            res?.status(404).send(`Tried to add token, but there is no account with userName "${userName}".`);
            return;
        }

        const token = jwt.sign(
            user,
            process.env.JWT_SECRET_KEY as string,
            { expiresIn: "60m" }
        );

        res?.cookie("thingspool_token", token, {
            secure: envUtil.isDevMode() ? false : true,
            httpOnly: true,
            sameSite: "strict",
        }).status(201);
    },
    clearToken: (res: Response): void => {
        res.clearCookie("thingspool_token").status(204);
    },
    authenticateToken: async (req: Request, res: Response,
        next: () => void): Promise<void> =>
    {
        await authUtil.authenticateToken_internal(next, false, req, res);
    },
    authenticateTokenOptional: async (req: Request, res: Response,
        next: () => void): Promise<void> =>
    {
        await authUtil.authenticateToken_internal(next, true, req, res);
    },
    authenticateToken_internal: async (next: () => void, optional: boolean,
        req: Request, res?: Response): Promise<boolean> =>
    {
        const user = authUtil.getUserFromReqToken(req);
        if (!user)
        {
            if (optional)
            {
                next();
                return true;
            }
            else
            {
                debugUtil.logRaw("Token-Authentication Failed", "high", "pink");
                res?.status(401).send("Token-Authentication Failed (User Not Found)");
                return false;
            }
        }
        else
        {
            try {
                await authUtil.addToken(user.userName, res); // refresh the token
                next();
                return true;
            }
            catch (err) {
                if (optional)
                {
                    next();
                    return true;
                }
                else
                {
                    debugUtil.log("Failed to add token", {err}, "high");
                    res?.status(401).send(`Failed to add token (error: ${err})`);
                    return false;
                }
            }
        }
    }
}

export default authUtil;