import ServerLogUtil from "../../networking/util/serverLogUtil";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import UserTokenUtil from "./userTokenUtil";
import UserSearchUtil from "./userSearchUtil";
import UserInputValidator from "../../../shared/user/util/userInputValidator";
import { localize } from "../../../shared/localization/util/locUtil";
import SearchDB from "../../db/searchDB";
import UserDB from "../../db/userDB";
dotenv.config();

const dev = process.env.MODE == "dev";

const UserAuthPasswordUtil =
{
    register: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!validateUserNameAndPassword(req, res))
                return;

            const existingUsersResult = await SearchDB.users.withUserNameOrEmail(
                req.body.userName, "test@example.com");
            if (!existingUsersResult.success)
            {
                res.status(500).send(`Internal Server Error (during search)`);
                return;
            }
            if (existingUsersResult.data.length > 0)
            {
                ServerLogUtil.log("User already exists", {
                    userName: req.body.userName,
                    email: "test@example.com",
                    existingUser: existingUsersResult.data[0]
                }, "high", "pink");

                res.status(403).send(`User "${req.body.userName}" (${"test@example.com"}) already exists.`);
                return;
            }
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            const success = await UserDB.createUser(
                req.body.userName, UserTypeEnumMap.Member, passwordHash, "test@example.com");
            if (!success)
            {
                res.status(500).send(`Internal Server Error (during registration)`);
                return;
            }

            const sqlUser = await UserSearchUtil.findExistingUserByUserName(req.body.userName, res); // Re-fetch the user object (because it could've been modified)
            if (!sqlUser)
                return;

            await UserTokenUtil.addTokenToUser(User.fromSQL(sqlUser), req, res);
        }
        catch (err)
        {
            ServerLogUtil.log("User Registration Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to register the user (${err}).`);
        }
    },
    login: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            if (!validateUserNameAndPassword(req, res))
                return;

            const sqlUser = await UserSearchUtil.findExistingUserByUserName(req.body.userName, res);
            if (!sqlUser)
                return;

            const passwordIsValid = await bcrypt.compare(req.body.password, sqlUser.passwordHash);

            if (!passwordIsValid)
            {
                ServerLogUtil.log("Wrong password", {passwordEntered: (dev ? req.body.password : "(HIDDEN)"), passwordHash: sqlUser.passwordHash}, "high", "pink");
                res.status(401).send("Wrong password.");
                return;
            }

            await UserTokenUtil.addTokenToUser(User.fromSQL(sqlUser), req, res);
        }
        catch (err)
        {
            ServerLogUtil.log("Login Error", {err}, "high", "pink");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
}

function validateUserNameAndPassword(req: Request, res: Response): boolean
{
    const userNameError = UserInputValidator.findErrorInUserName(req.body.userName);
    if (userNameError != null)
    {
        ServerLogUtil.log("UserName Error", {userName: req.body.userName, userNameError}, "high", "pink");
        res.status(400).send(localize(userNameError));
        return false;
    }
    const passwordError = UserInputValidator.findErrorInPassword(req.body.password);
    if (passwordError != null)
    {
        ServerLogUtil.log("Password Error", {password: (dev ? req.body.password : "(HIDDEN)"), passwordError}, "high", "pink");
        res.status(400).send(localize(passwordError));
        return false;
    }
    return true;
}

export default UserAuthPasswordUtil;