const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const authUtil = require("./util/authUtil");
const emailUtil = require("./util/emailUtil");
const envUtil = require("./util/envUtil");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

const bypassDynamicPages = globalConfig.page.bypassDynamicPages;

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
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});
app.post("/api/vemail", async (req, res) => {
    await emailUtil.startEmailVerification(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});
app.post("/api/login", async (req, res) => {
    await authUtil.login(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});
app.delete("/api/logout", (req, res) => {
    authUtil.clearToken(res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
})

if (envUtil.isDevMode())
{
    app.get("/debug/users", async (req, res) => {
        res.send(JSON.stringify(await authUtil.getAllUsers()));
    });
    app.get("/debug/vemails", async (req, res) => {
        res.send(JSON.stringify(emailUtil.getAllPendingVerifications()));
    });
}

//-----------------------------------------------------------------
// Dynamic Page Routes
//-----------------------------------------------------------------

if (!bypassDynamicPages)
{
    app.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
        const user = (req.user == undefined) ? undefined : await authUtil.getUser(req.user.username);

        res.render("page/index", {
            envUtil,
            ejsChunkRootPath: "../chunk",
            isStaticPage: false,
            user: user,
            loginDestination: "",
        });
    });

    app.get("/page/register.html", (req, res) => {
        res.render("page/register", {
            envUtil,
            ejsChunkRootPath: "../chunk",
            isStaticPage: false,
            user: req.user,
            registerDestination: "",
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
}

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