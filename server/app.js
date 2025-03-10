const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const authUtil = require("./utils/authUtil");
const emailUtil = require("./utils/emailUtil");
require("dotenv").config();

//if (process.env.MODE == "dev")
//    require("../contentGenerator/generator.js");

const app = express();

// config

app.set("view engine", "ejs");

// middleware

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// database

const users = {}; // dummy database

//-----------------------------------------------------------------
// API Routes
//-----------------------------------------------------------------

app.post("/api/register", async (req, res) => {
    await authUtil.register(req, res);
});
app.post("/api/vemail", (req, res) => {
    emailUtil.startEmailVerification(req, res);
});
app.post("/api/login", async (req, res) => {
    await authUtil.login(req, res);
});
app.delete("/api/logout", (req, res) => {
    authUtil.clearToken(res);
})
app.get("/api/user/:username", authUtil.authenticateToken, async (req, res) => {
    if (!req.params.username)
        return res.status(401).json({ message: "Username not specified." });
    if (users[req.params.username] == undefined)
        return res.status(404).json({ message: "Username not found." });
    res.send(JSON.stringify(users[req.params.username]));
});
app.get("/api/users", async (req, res) => {
    res.send(JSON.stringify(users));
});

//-----------------------------------------------------------------
// Dynamic Page Routes
//-----------------------------------------------------------------

app.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/index", { user: req.user }); // login page or dashboard
});
app.get("/page/register", (req, res) => {
    res.render("page/register");
});

//-----------------------------------------------------------------
// Static Content Routes
//-----------------------------------------------------------------

app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));

//-----------------------------------------------------------------
// Start
//-----------------------------------------------------------------

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}.`);
});