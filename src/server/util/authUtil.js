const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const envUtil = require("./envUtil.js");
const emailUtil = require("./emailUtil.js");
const dbSearch = require("../db/dbSearch.js");
const dbAuth = require("../db/dbAuth.js");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
require("dotenv").config();

const authUtil =
{
    register: async (req, res) =>
    {
        try
        {
            const userNameError = textUtil.findErrorInUserName(req.body.userName);
            if (userNameError != null)
                return res.status(400).send(userNameError);

            const passwordError = textUtil.findErrorInPassword(req.body.password);
            if (passwordError != null)
                return res.status(400).send(passwordError);

            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
                return res.status(400).send(emailError);

            let existingUsers = await dbSearch.users.withUserName(res, req.body.userName);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
                return res.status(403).send(`User "${req.body.userName}" already exists.`);

            existingUsers = await dbSearch.users.withEmail(res, req.body.email);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            if (existingUsers && existingUsers.length > 0)
                return res.status(403).send(`There is already an account with the email "${req.body.email}".`);
    
            await emailUtil.endEmailVerification(req, res);
            if (res.statusCode < 200 || res.statusCode >= 300)
            {
                console.error(`Failed to end email verification (status = ${res.statusCode})`);
                return;
            }
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            await dbAuth.registerNewUser(res, req.body.userName, passwordHash, req.body.email);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;

            authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            res.status(500).send(`ERROR: Failed to register the user (${err}).`);
        }
    },
    login: async (req, res) =>
    {
        try
        {
            const userNameError = textUtil.findErrorInUserName(req.body.userName);
            if (userNameError != null)
                return res.status(400).send(userNameError);

            const passwordError = textUtil.findErrorInPassword(req.body.password);
            if (passwordError != null)
                return res.status(400).send(passwordError);

            const user = await authUtil.findExistingUser(req.body.userName, res);
            if (!user)
                return;

            const validPassword = await bcrypt.compare(req.body.password, user.passwordHash);

            if (!validPassword)
                return res.status(401).send("Wrong password.");

            authUtil.addToken(req.body.userName, res);
        }
        catch (err)
        {
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
    findExistingUser: async (userName, res) => {
        let existingUsers = await dbSearch.users.withUserName(res, userName);
        if (res.statusCode < 200 || res.statusCode >= 300)
            return;
        if (!existingUsers || existingUsers.length == 0)
            return res.status(404).send(`There is no account with userName "${userName}".`);
        return existingUsers[0];
    },
    addToken: (userName, res) => {
        const token = jwt.sign(
            { userName: userName },
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
        const token = req.cookies["thingspool_token"];

        if (!token)
        {
            if (optional)
            {
                req.user = undefined;
                next();
            }
            else
            {
                res.status(401).send("Token not provided.");
            }
        }
        else
        {
            try {
                const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);

                const user = await authUtil.findExistingUser(payload.userName, res);
                if (!user)
                    return;
                req.user = user;
                authUtil.addToken(user.userName, res); // refresh the token
                next();
            }
            catch (err) {
                if (optional)
                {
                    req.user = undefined;
                    next();
                }
                else
                {
                    res.status(401).send("Invalid token.");
                }
            }
        }
    }
}

module.exports = authUtil;