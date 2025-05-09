const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const envUtil = require("./envUtil.js");
const emailUtil = require("./emailUtil.js");
const dbSearch = require("../db/dbSearch.js");
const dbAuth = require("../db/dbAuth.js");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
const debugUtil = require("./debugUtil.js");
require("dotenv").config();

const dev = envUtil.isDevMode();

const authUtil =
{
    register: async (req, res) =>
    {
        try
        {
            if (!authUtil.validateUserNameAndPassword(req, res))
                return;

            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
            {
                debugUtil.log("Email Input Error", {email: req.body.email, emailError}, "high");
                return res.status(400).send(emailError);
            }

            let existingUsers = await dbSearch.users.withUserName(res, req.body.userName);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
            {
                debugUtil.log("UserName already exists", {userName: req.body.userName, existingUser: existingUsers[0]}, "high");
                return res.status(403).send(`User "${req.body.userName}" already exists.`);
            }

            existingUsers = await dbSearch.users.withEmail(res, req.body.email);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
            {
                debugUtil.log("There is already an account with the same email", {email: req.body.email, existingUser: existingUsers[0]}, "high");
                return res.status(403).send(`There is already an account with the email "${req.body.email}".`);
            }
    
            await emailUtil.endEmailVerification(req, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            await dbAuth.registerNewUser(res, req.body.userName, passwordHash, req.body.email);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            await authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            debugUtil.log("User Registration Error", {err}, "high");
            res.status(500).send(`ERROR: Failed to register the user (${err}).`);
        }
    },
    login: async (req, res) =>
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
                debugUtil.log("Wrong password", {passwordEntered: (dev ? req.body.password : "(HIDDEN)"), passwordHash: user.passwordHash}, "high");
                return res.status(401).send("Wrong password.");
            }

            await authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            debugUtil.log("Login Error", {err}, "high");
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
    validateUserNameAndPassword: (req, res) => {
        const userNameError = textUtil.findErrorInUserName(req.body.userName);
        if (userNameError != null)
        {
            debugUtil.log("UserName Input Error", {userName: req.body.userName, userNameError}, "high");
            res.status(400).send(userNameError);
            return false;
        }
        const passwordError = textUtil.findErrorInPassword(req.body.password);
        if (passwordError != null)
        {
            debugUtil.log("Password Input Error", {password: (dev ? req.body.password : "(HIDDEN)"), passwordError}, "high");
            res.status(400).send(passwordError);
            return false;
        }
        return true;
    },
    findExistingUserByUserName: async (userName, res) => {
        let existingUsers = await dbSearch.users.withUserName(res, userName);
        if (res.statusCode < 200 || res.statusCode >= 300)
            return;
        if (!existingUsers || existingUsers.length == 0)
        {
            debugUtil.log("User Not Found", {userName}, "high");
            return res.status(404).send(`There is no account with userName "${userName}".`);
        }
        return existingUsers[0];
    },
    getUserFromReqToken: (req, optional = false) => {
        const token = req.cookies["thingspool_token"];
        if (!token)
        {
            if (!optional)
                debugUtil.log("Token Not Found in Request", {}, "high");
            return null;
        }
        return authUtil.getUserFromToken(token);
    },
    getUserFromToken: (token) => {
        const user = jwt.verify(token, process.env.JWT_SECRET_KEY);
        if (!user)
        {
            debugUtil.log("User Not Found In Token", {token}, "high");
            return null;
        }
        return user;
    },
    addToken: async (userName, res) => {
        const user = await authUtil.findExistingUserByUserName(userName, res); // Re-fetch the user object (because it could've been modified)
        if (!user)
        {
            debugUtil.log("AddToken Tried, User Not Found", {userName, token}, "high");
            return res.status(404).send(`Tried to add token, but there is no account with userName "${userName}".`);
        }

        const token = jwt.sign(
            user,
            process.env.JWT_SECRET_KEY,
            { expiresIn: "60m" }
        );

        res.cookie("thingspool_token", token, {
            secure: envUtil.isDevMode() ? false : true,
            httpOnly: true,
            sameSite: "strict",
        }).status(201);
    },
    clearToken: (res) => {
        res.clearCookie("thingspool_token").status(204);
    },
    authenticateToken: async (req, res, next) =>
    {
        await authUtil.authenticateToken_internal(req, res, next, false);
    },
    authenticateTokenOptional: async (req, res, next) =>
    {
        await authUtil.authenticateToken_internal(req, res, next, true);
    },
    authenticateToken_internal: async (req, res, next, optional) =>
    {
        const user = authUtil.getUserFromReqToken(req);
        if (!user)
        {
            if (optional)
            {
                next();
            }
            else
            {
                debugUtil.logRaw("Token-Authentication Failed", "high");
                res.status(401).send("Token-Authentication Failed (User Not Found)");
            }
        }
        else
        {
            try {
                await authUtil.addToken(user.userName, res); // refresh the token
                next();
            }
            catch (err) {
                if (optional)
                {
                    next();
                }
                else
                {
                    debugUtil.log("Failed to add token", {err}, "high");
                    res.status(401).send(`Failed to add token (error: ${err})`);
                }
            }
        }
    }
}

module.exports = authUtil;