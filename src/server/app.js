const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const authUtil = require("./util/authUtil");
const emailUtil = require("./util/emailUtil");
const envUtil = require("./util/envUtil");
require("dotenv").config();

if (envUtil.isDevMode())
    require("../contentGenerator/generator.js");

const app = express();

// config

app.set("view engine", "ejs");

// middleware

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// database

//...

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
app.get("/api/users", async (req, res) => {
    res.send(JSON.stringify(users));
});

//-----------------------------------------------------------------
// Dynamic Page Routes
//-----------------------------------------------------------------

app.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/index", {
        envUtil,
        ejsChunkRootPath: "../chunk",
        isStaticPage: false,
        user: req.user,
        loginDestination: "",
    });
});
app.get("/page/register.html", (req, res) => {
    res.render("page/register", {
        envUtil,
        ejsChunkRootPath: "../chunk",
        isStaticPage: false,
        user: req.user,
        registerDestination: ""
    });
});

app.get("/page/social.html", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/social", {
        envUtil,
        ejsChunkRootPath: "../chunk",
        isStaticPage: false,
        user: req.user,
        loginDestination: "page/social.html",
    });
});

//-----------------------------------------------------------------
// Static Content Routes
//-----------------------------------------------------------------

app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));
app.use("/src_client", express.static(path.join(process.env.PWD, "src/client")));
app.use("/src_shared", express.static(path.join(process.env.PWD, "src/shared")));

//-----------------------------------------------------------------
// Start
//-----------------------------------------------------------------

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}.`);
});