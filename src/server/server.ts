import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import SSG from "./SSG/SSG";
import DB from "./DB/DB";
import Router from "./Router/Router";
import Sockets from "./Sockets/Sockets";
import EnvUtil from "./Util/EnvUtil";
import dotenv from "dotenv";
dotenv.config();

require("./Util/ServiceLocatorUtil");
require("./Test/Test");

async function Server(): Promise<void>
{
    // SSG = "Static Site Generator"
    if (EnvUtil.isDevMode()) // If you are in dev mode, rebuild the static pages on restart.
    {
        await SSG();
    }
    else if (EnvUtil.isSSGMode()) // If you are in ssg mode, just rebuild the static pages and quit immediately.
    {
        await SSG();
        return;
    }

    // database initialization
    DB.runSQLFile("init.sql");

    // express app
    const app = express();
    const server = http.createServer(app);

    // config
    app.set("view engine", "ejs");

    // middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    // router
    Router(app);

    // server connection
    server.listen(process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${process.env.PORT}.`);
    });

    // socket connection
    Sockets(server);
}

Server();