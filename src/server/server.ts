import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import SSG from "./ssg/ssg";
import DB from "./db/db";
import Router from "./router/router";
import Sockets from "./sockets/sockets";
import dotenv from "dotenv";
dotenv.config();

require("./util/serviceLocatorUtil");
require("./test/test");

async function Server(): Promise<void>
{
    // SSG = "Static Site Generator"
    if (process.env.MODE == "dev") // If you are in dev mode, rebuild the static pages on restart.
    {
        await SSG();
    }
    else if (process.env.MODE == "ssg") // If you are in ssg mode, just rebuild the static pages and quit immediately.
    {
        await SSG();
        return;
    }

    // database initialization
    await DB.runSQLFile("clear.sql"); // <--- TODO: Remove this once the data migration system gets implemented.
    await DB.runSQLFile("init.sql");

    // express app
    const app = express();
    const server = http.createServer(app);

    // config
    app.set("view engine", "ejs");

    // middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(hpp()); // for HTTP parameter pollution prevention

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