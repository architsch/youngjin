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
import RoomDB from "./db/roomDB";
import NetworkUtil from "./util/networkUtil";
import dbTask_init from "./db/tasks/dbTask_init";
dotenv.config();

async function Server(): Promise<void>
{
    // SSG = "Static Site Generator"
    if (!process.env.SKIP_SSG)
    {
        if (process.env.MODE == "dev") // If you are in dev mode, rebuild the static pages on restart.
        {
            await SSG();
        }
        else if (process.env.MODE == "ssg") // If you are in ssg mode, just rebuild the static pages and quit immediately.
        {
            await SSG();
            return;
        }
    }

    // database initialization

    if (!(await DB.runQuery(`DROP DATABASE IF EXISTS main;`)).success) return; // <--- Reset the DB every time the server restarts (TODO: Remove this once the DB system gets fully stabilized.)
    if (!(await DB.runQuery(`CREATE DATABASE IF NOT EXISTS main;`)).success) return;
    if (!(await DB.runQuery(`USE main;`)).success) return;
    if (!(await DB.runQuery(`CREATE TABLE IF NOT EXISTS globalData (dbVersion INT NOT NULL);`)).success) return;
    
    let result = await DB.runQuery<number>(`SELECT dbVersion FROM globalData;`);
    if (!result.success)
        return;

    if (!result.data || result.data.length == 0) // dbVersion doesn't exist yet. (i.e. This is the first-time setup)
    {
        if (!(await dbTask_init())) return;
    }
    else // dbVersion already exists. (i.e. This is either an up-to-date or outdated DB)
    {
        let dbVersion = result.data[0];
        console.log(`Current DB Version: ${dbVersion}`);

        // Implement version migration routines here:
        // if (dbVersion == 0)
        // ...
    }
    
    let success = await RoomDB.createRoom("entrypoint", "", 0, 1, 2, `${process.env.MODE == "dev" ? `http://${NetworkUtil.getLocalIpAddress()}:${process.env.PORT}` : process.env.URL_STATIC}/app/assets/texture_packs/default.jpg`);
    if (!success)
        return;

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

// Prevent automatic restart when the server app crashes (only on dev mode)
if (process.env.MODE == "dev")
    setInterval(() => {}, 36000000);