const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const db = require("./db/db.js");
const envUtil = require("./util/envUtil.js");
const ejsUtil = require("./util/ejsUtil.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
const test = require("../test/test.js");
const testDB = require("../test/testDB.js");
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
    // Popup Routes
    //-----------------------------------------------------------------

    app.use("/popup", require("./routers/popupRouter.js"));

    //-----------------------------------------------------------------
    // API Routes
    //-----------------------------------------------------------------

    app.use("/api/auth", require("./routers/authRouter.js"));
    app.use("/api/search", require("./routers/searchRouter.js"));
    app.use("/api/room", require("./routers/roomRouter.js"));

    //-----------------------------------------------------------------
    // Test Routes
    //-----------------------------------------------------------------

    if (dev)
    {
        app.get("/test/ui", async (req, res) => {
            res.render("page/misc/uiTest", ejsUtil.makeEJSParams(
                {user: undefined, loginDestination: "", registerDestination: ""}));
        });
        
        app.get("/test/:testname", async (req, res) => {
            await test(req.params.testname);
            const content_realDB = await db.toHTMLString();
            const content_testDB = testDB.toHTMLString();
            res.render("page/misc/console", { content: `
                <div style="margin:0 0 0 0; padding:1% 1% 1% 1%; overflow:scroll; width:50%; height:100%; left:0; right:50%; top:0; bottom:0;">
                    ${content_realDB}
                </div>
                <div style="margin:0 0 0 0; padding:1% 1% 1% 1%; overflow:scroll; width:50%; height:100%; left:50%; right:0; top:0; bottom:0;">
                    ${content_testDB}
                </div>
            `.replace(/\s+/g, " ")});
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