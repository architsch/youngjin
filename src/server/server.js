const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const dbUtil = require("./util/dbUtil.js");
const authUtil = require("./util/authUtil.js");
const emailUtil = require("./util/emailUtil.js");
const envUtil = require("./util/envUtil.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

async function run()
{
    const dev = envUtil.isDevMode();

    if (dev)
        await require("../contentGenerator/generator.js").run();

    const app = express();

    // config

    app.set("view engine", "ejs");

    // middleware

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

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

    //-----------------------------------------------------------------
    // Dynamic Page Routes
    //-----------------------------------------------------------------

    if (!globalConfig.page.bypassDynamicPages)
    {
        app.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
            const users = (req.user == undefined) ? [undefined] : await dbUtil.users.selectByUserName(res, req.user.userName);
            if (res.statusCode < 200 || res.statusCode >= 300)
                return;
            
            res.render("page/index", {
                envUtil,
                ejsChunkRootPath: "../chunk",
                isStaticPage: false,
                user: users[0],
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
    // Debug Routes
    //-----------------------------------------------------------------

    if (dev)
    {
        app.get("/debug/db", async (req, res) => {
            const section = (text) => `\n\n<h1>${text}</h1>\n`;
            const toSafeStr = (obj) => JSON.stringify(obj, null, 4)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            const content =
                section("users") + toSafeStr(await dbUtil.debug.users()) +
                section("rooms") + toSafeStr(await dbUtil.debug.rooms()) +
                section("user_rooms") + toSafeStr(await dbUtil.debug.user_rooms()) +
                section("emailVerifications") + toSafeStr(await dbUtil.debug.emailVerifications());
            res.render("page/console", { content });
        });
    }

    //-----------------------------------------------------------------
    // Test Routes
    //-----------------------------------------------------------------

    if (dev)
    {
        const test = require("../test/test.js");

        app.get("/test/:testname", (req, res) => {
            test(req.params.testname);
            res.status(200).send(`Test Triggered :: ${req.params.testname}`);
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
}

module.exports.run = run;