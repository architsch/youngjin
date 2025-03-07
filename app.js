const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

//-----------------------------------------------------------------
// config
//-----------------------------------------------------------------

app.set("view engine", "ejs");

//-----------------------------------------------------------------
// middleware
//-----------------------------------------------------------------

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function authenticateToken(req, res, next)
{
    authenticateToken_internal(req, res, next, false);
}
function authenticateTokenOptional(req, res, next)
{
    authenticateToken_internal(req, res, next, true);
}
function authenticateToken_internal(req, res, next, optional)
{
    const authHeader = req.headers["Authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token)
    {
        if (optional)
        {
            req.user = undefined;
            next();
        }
        else
        {
            return res.status(401).json({ message: "Token not provided." });
        }
    }

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
                return res.status(403).json({ message: "Invalid token." });
            }
        }
        else
        {
            req.user = user;
            next();
        }
    });
}

//-----------------------------------------------------------------
// database
//-----------------------------------------------------------------

const users = {}; // dummy database

//-----------------------------------------------------------------
// routes
//-----------------------------------------------------------------

app.post("/api/register", async (req, res) => {
    try
    {
        if (users[req.body.username] != undefined)
            return res.status(403).json({ message: `Username "${req.body.username}" already exists.` });

        const passwordHash = await bcrypt.hash(req.body.password, 10);

        const newUser = {
            username: req.body.username,
            password: passwordHash,
        };
        users[newUser.username] = newUser;

        res.status(201).json(newUser);
    }
    catch (err)
    {
        res.status(500).json({ message: "ERROR: Failed to register the user." });
    }
});

app.post("/api/login", async (req, res) => {
    try
    {
        const user = users[req.body.username];

        if (user == undefined)
            return res.status(404).json({ message: `Username "${req.body.username}" does not exist.` });

        const validPassword = await bcrypt.compare(req.body.password, user.password);

        if (!validPassword)
            return res.status(401).json({ message: "Wrong password." });

        const token = jwt.sign(
            { username: user.username },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "1h" }
        );

        res.json({ token: token });
    }
    catch (err)
    {
        res.status(500).json({ message: "ERROR: Failed to login." });
    }
});

app.delete("/api/user", authenticateToken, async (req, res) => {
    delete users[req.user.username];
    res.status(200).json({ user: req.user });
});

app.get("/api/user", authenticateToken, async (req, res) => {
    res.send(JSON.stringify(users[req.user.username]));
});

app.get("/api/users", async (req, res) => {
    res.send(JSON.stringify(users));
});

app.get("/", authenticateTokenOptional, async (req, res) => {
    res.render("pages/index", { user: req.user });
});

//-----------------------------------------------------------------
// Static Content
//-----------------------------------------------------------------

app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));

//-----------------------------------------------------------------
// start
//-----------------------------------------------------------------

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}.`);
});