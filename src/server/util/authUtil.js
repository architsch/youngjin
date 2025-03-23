const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const envUtil = require("./envUtil.js");
const emailUtil = require("./emailUtil.js");
const textUtil = require("../../shared/util/textUtil.mjs").textUtil;
require("dotenv").config();

const users = {}; // dummy database

const authUtil =
{
    getAllUsers: async () =>
    {
        return users;
    },
    getUser: async (username) =>
    {
        return users[username];
    },
    register: async (req, res) =>
    {
        try
        {
            const usernameError = textUtil.findErrorInUsername(req.body.username);
            if (usernameError != null)
                return res.status(400).send(usernameError);

            const passwordError = textUtil.findErrorInPassword(req.body.password);
            if (passwordError != null)
                return res.status(400).send(passwordError);

            const emailError = textUtil.findErrorInEmailAddress(req.body.email);
            if (emailError != null)
                return res.status(400).send(emailError);

            if (users[req.body.username] != undefined)
                return res.status(403).send(`User "${req.body.username}" already exists.`);
    
            for (const userInfo of Object.values(users))
            {
                if (userInfo.email == req.body.email)
                    return res.status(403).send(`There is already an account with the email "${req.body.username}".`);
            }
    
            emailUtil.endEmailVerification(req, res);
            if (res.statusCode != 202)
            {
                console.error(`Failed to end email verification (status = ${res.statusCode})`);
                return;
            }
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            const newUser = {
                username: req.body.username,
                passwordHash: passwordHash,
                email: req.body.email,
            };
            users[newUser.username] = newUser;
    
            authUtil.addToken(newUser, res);
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
            const usernameError = textUtil.findErrorInUsername(req.body.username);
            if (usernameError != null)
                return res.status(400).send(usernameError);

            const passwordError = textUtil.findErrorInPassword(req.body.password);
            if (passwordError != null)
                return res.status(400).send(passwordError);

            const user = users[req.body.username];

            if (user == undefined)
                return res.status(404).send(`Username "${req.body.username}" does not exist in the database.`);

            const validPassword = await bcrypt.compare(req.body.password, user.passwordHash);

            if (!validPassword)
                return res.status(401).send("Wrong password.");

            authUtil.addToken(user, res);
        }
        catch (err)
        {
            res.status(500).send(`ERROR: Failed to login (${err}).`);
        }
    },
    addToken: (user, res) => {
        const token = jwt.sign(
            { username: user.username },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "30m" }
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
    authenticateToken: (req, res, next) =>
    {
        authUtil.authenticateToken_internal(req, res, next, false);
    },
    authenticateTokenOptional: (req, res, next) =>
    {
        authUtil.authenticateToken_internal(req, res, next, true);
    },
    authenticateToken_internal: (req, res, next, optional) =>
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
            jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
                if (err)
                {
                    if (optional)
                    {
                        req.user = undefined;
                        next();
                    }
                    else
                    {
                        res.status(403).send("Invalid token.");
                    }
                }
                else
                {
                    req.user = user;
                    authUtil.addToken(user, res); // refresh the token
                    next();
                }
            });
        }
    }
}

module.exports = authUtil;