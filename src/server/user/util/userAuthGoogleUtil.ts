import { Request, Response } from "express";
import UserTokenUtil from "./userTokenUtil";
import UserSearchUtil from "./userSearchUtil";
import DBUserUtil from "../../db/util/dbUserUtil";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import url from "url";
import crypto from "crypto";
import RestAPI from "../../../client/networking/api/restAPI";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import DBUser from "../../../server/db/types/row/dbUser";
import { USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";
import AddressUtil from "../../networking/util/addressUtil";
import LogUtil from "../../../shared/system/util/logUtil";

const dev = process.env.MODE == "dev";
if (dev)
    require("dotenv").config({ path: ".env.emulator" });

const UserAuthGoogleUtil =
{
    login: async (req: Request, res: Response): Promise<void> =>
    {
        res.redirect(generateOAuthURL());
    },
    loginCallback: async (req: Request, res: Response): Promise<void> =>
    {
        try
        {
            const query = url.parse(req.url, true).query;
            if (!query || !query.code)
            {
                res.status(400).send(`Google OAuth code not found.`);
                return;
            }
            const accessTokenRes = await RestAPI.post(generateTokenURL(query.code as string));
            if (accessTokenRes.status < 200 || accessTokenRes.status >= 300)
            {
                res.status(500).send(`Failed to fetch the access token from Google API.`);
                return;
            }
            const accessToken = accessTokenRes.data.access_token as string;
            const userInfoRes = await RestAPI.get(userInfoURL, {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });
            if (userInfoRes.status < 200 || userInfoRes.status >= 300)
            {
                res.status(500).send(`Failed to fetch the user info from Google API.`);
                return;
            }
            const userInfo = userInfoRes.data as GoogleUserInfo;
            const email = userInfo.email;
            if (!email)
            {
                res.status(404).send("Email address not found.");
                return;
            }
            const userNameBase = email.split("@")[0];
            let userName = userNameBase;

            const existingUsersResult = await DBSearchUtil.users.withEmail(email);
            if (!existingUsersResult.success)
            {
                res.status(500).send(`Internal Server Error`);
                return;
            }

            let dbUser: DBUser | null = null;

            if (existingUsersResult.data.length == 0) // new user
            {
                let numNameCopies = 0;
                while (!dbUser && ++numNameCopies <= 5)
                {
                    if (numNameCopies >= 2)
                        userName = `${userNameBase}#${numNameCopies}`;
                    const nameConflictingUsersResult = await DBSearchUtil.users.withUserName(userName);
                    if (!nameConflictingUsersResult.success)
                    {
                        res.status(500).send(`Internal Server Error`);
                        return;
                    }
                    if (nameConflictingUsersResult.data.length == 0) // free userName found
                    {
                        const result = await DBUserUtil.createUser(
                            userName, UserTypeEnumMap.Member, "", email);
                        if (!result.success)
                        {
                            res.status(500).send(`Internal Server Error (during registration)`);
                            return;
                        }
                        dbUser = await UserSearchUtil.findExistingUserByUserName(userName, res);
                        if (!dbUser)
                            return;
                    }
                }
                if (!dbUser)
                {
                    res.status(500).send(`Username "${userNameBase}" is used too many times.`);
                    return;
                }
            }
            else // previously registered user
            {
                dbUser = existingUsersResult.data[0];
            }

            if (dbUser)
                await UserTokenUtil.addTokenToUser(DBUserUtil.fromDBType(dbUser), req, res);
            else
                res.status(500).send(`Internal Server Error`);
        }
        catch (err)
        {
            LogUtil.log("Login Error", {err}, "high", "error");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
}

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const redirectURL = `${AddressUtil.getEnvDynamicURL()}/${USER_API_ROUTE_PATH}/login_google_callback`;
const userInfoURL = `https://www.googleapis.com/oauth2/v3/userinfo?alt=json`;

function generateOAuthURL(): string
{
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectURL}&scope=openid%20profile%20email&access_type=offline&state=${crypto.randomUUID()}&prompt=consent`;
}

function generateTokenURL(code: string): string
{
    return `https://oauth2.googleapis.com/token?code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectURL}&grant_type=authorization_code`;
}

interface GoogleUserInfo
{
  sub: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  hd?: string; // Hosted domain e.g. example.com
}

export default UserAuthGoogleUtil;