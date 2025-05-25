import path from "path";
import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import envUtil from "./util/envUtil";
import globalConfig from "./config/globalConfig";
import ssg from "./ssg/ssg";
import authRouter from "./routers/authRouter";
import pageRouter from "./routers/pageRouter";
import popupRouter from "./routers/popupRouter";
import roomRouter from "./routers/roomRouter";
import searchRouter from "./routers/searchRouter";
import sockets from "./sockets/sockets";
import dotenv from "dotenv";
dotenv.config();

export default async function website(): Promise<void>
{
    const dev = envUtil.isDevMode();

    // Regenerate the static pages when the dev-server restarts (to reflect any CSS changes, etc)
    if (dev)
        await ssg();

    const app = express();
    const server = http.createServer(app);

    // config
    app.set("view engine", "ejs");

    // middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    //-----------------------------------------------------------------
    // Routes
    //-----------------------------------------------------------------

    if (!globalConfig.page.bypassDynamicPages)
        app.use("/", pageRouter);
    app.use("/popup", popupRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/search", searchRouter);
    app.use("/api/room", roomRouter);
    app.use(express.static(path.join(process.env.PWD as string, process.env.STATIC_PAGE_ROOT_DIR as string)));

    //-----------------------------------------------------------------
    // Start Server
    //-----------------------------------------------------------------

    server.listen(process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${process.env.PORT}.`);
    });
    sockets(server);
}