const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const db = require("./db/db.js");
const envUtil = require("./util/envUtil.js");
const ejsUtil = require("./util/ejsUtil.js");
const textUtil = require("../shared/util/textUtil.mjs").textUtil;
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
    // Page Routes
    //-----------------------------------------------------------------

    if (!globalConfig.page.bypassDynamicPages)
        app.use("/", require("./routers/pageRouter.js"));

    //-----------------------------------------------------------------
    // API Routes
    //-----------------------------------------------------------------

    app.use("/api/auth", require("./routers/authRouter.js"));
    app.use("/api/search", require("./routers/searchRouter.js"));
    app.use("/api/room", require("./routers/roomRouter.js"));

    //-----------------------------------------------------------------
    // Debug Routes
    //-----------------------------------------------------------------

    if (dev)
    {
        app.get("/debug/db", async (req, res) => {
            const section = (text) => `\n\n<h1>${text}</h1>\n`;
            const toSafeStr = (obj) => textUtil.escapeHTMLChars(JSON.stringify(obj, null, 4));
            const content =
                section("users") + toSafeStr(await db.debug.users()) +
                section("rooms") + toSafeStr(await db.debug.rooms()) +
                section("user_rooms") + toSafeStr(await db.debug.user_rooms()) +
                section("emailVerifications") + toSafeStr(await db.debug.emailVerifications());
            res.render("page/misc/console", { content });
        });

        app.get("/debug/ui", async (req, res) => {
            res.render("page/misc/uiTest", ejsUtil.makeEJSParams(
                {user: undefined, loginDestination: "", registerDestination: ""}));
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
    // Popup Routes
    //-----------------------------------------------------------------

    app.use("/popup", require("./routers/popupRouter.js"));

    //-----------------------------------------------------------------
    // Start
    //-----------------------------------------------------------------

    app.listen(process.env.PORT, () => {
        console.log(`Listening to port ${process.env.PORT}.`);
    });
}

module.exports.run = run;