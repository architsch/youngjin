const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const envUtil = require("./util/envUtil.js");
const globalConfig = require("../shared/config/globalConfig.mjs").globalConfig;
require("dotenv").config();

async function run()
{
    const dev = envUtil.isDevMode();

    if (dev)
        await require("../contentGenerator/generator.js").run();

    const app = express();
    const server = require("http").createServer(app);

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
    // Static Content Routes
    //-----------------------------------------------------------------

    app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));
    app.use("/src_client", express.static(path.join(process.env.PWD, "src/client")));
    app.use("/src_shared", express.static(path.join(process.env.PWD, "src/shared")));

    //-----------------------------------------------------------------
    // Start Server
    //-----------------------------------------------------------------

    server.listen(process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${process.env.PORT}.`);
    });
    require("./socket/sockets.js").init(server);
}

module.exports.run = run;