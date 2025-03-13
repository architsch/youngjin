const jwt = require("jsonwebtoken");
require("dotenv").config();

const authUtil =
{
    register: async (req, res) =>
    {
        try
        {
            if (users[req.body.username] != undefined)
                return res.status(403).json({ message: `User "${req.body.username}" already exists.` });
    
            for (const userInfo of Object.values(users))
            {
                if (userInfo.email == req.body.email)
                    return res.status(403).json({ message: `There is already an account with the email "${req.body.username}".` });
            }
    
            emailUtil.endEmailVerification(req, res);
            if (!res.ok)
                return;
    
            const passwordHash = await bcrypt.hash(req.body.password, 10);
    
            const newUser = {
                username: req.body.username,
                password: passwordHash,
                email: req.body.email,
            };
            users[newUser.username] = newUser;
    
            authUtil.addToken(user, res);
        }
        catch (err)
        {
            res.status(500).json({ message: `ERROR: Failed to register the user (${err}).` });
        }
    },
    login: async (req, res) =>
    {
        try
        {
            const user = users[req.body.username];

            if (user == undefined)
                return res.status(404).json({ message: `Username "${req.body.username}" does not exist.` });

            const validPassword = await bcrypt.compare(req.body.password, user.password);

            if (!validPassword)
                return res.status(401).json({ message: "Wrong password." });

            authUtil.addToken(user, res);
        }
        catch (err)
        {
            res.status(500).json({ message: "ERROR: Failed to login." });
        }
    },
    addToken: (user, res) => {
        const token = jwt.sign(
            { username: user.username },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "30m" }
        );
        res.cookie("thingspool_token", token, {
            //secure: true,
            httpOnly: true,
            sameSite: "strict",
        });
    },
    clearToken: (res) => {
        res.clearCookie("thingspool_token");
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
                res.status(401).json({ message: "Token not provided." });
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
                        res.status(403).json({ message: "Invalid token." });
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