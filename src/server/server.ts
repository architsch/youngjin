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

async function Server(): Promise<void>
{
console.log("0");
    // SSG = "Static Site Generator"
    if (process.env.MODE == "dev") // If you are in dev mode, rebuild the static pages on restart.
    {
        console.log("01");
        await SSG();
    }
    else if (process.env.MODE == "ssg") // If you are in ssg mode, just rebuild the static pages and quit immediately.
    {
        console.log("02");
        await SSG();
        return;
    }
console.log("1");
    // database initialization
    await DB.runSQLFile("clear.sql"); // <--- TODO: Remove this once the data migration system gets implemented.
    await DB.runSQLFile("init.sql");
console.log("2");
    // express app
    const app = express();
    const server = http.createServer(app);
console.log("3");
    // config
    app.set("view engine", "ejs");
console.log("4");
    // middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(hpp()); // for HTTP parameter pollution prevention
console.log("5");
    // router
    Router(app);
console.log("6");
    // server connection
    server.listen(process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${process.env.PORT}.`);
    });
console.log("7");
    // socket connection
    Sockets(server);
}

Server();