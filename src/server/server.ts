import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import SSG from "./ssg/ssg";
import Router from "./router/router";
import Sockets from "./sockets/sockets";
import DBRoomUtil from "./db/util/dbRoomUtil";
import AddressUtil from "./networking/util/addressUtil";
import { RoomTypeEnumMap } from "../shared/room/types/roomType";
import DBSearchUtil from "./db/util/dbSearchUtil";
import { LOCALHOST_PORT, URL_STATIC } from "./system/serverConstants";

const dev = process.env.MODE == "dev";

async function Server(): Promise<void>
{
    // SSG = "Static Site Generator"
    if (!process.env.SKIP_SSG)
    {
        if (dev) // If you are in dev mode, rebuild the static pages on restart.
        {
            await SSG();
        }
        else if (process.env.MODE == "ssg") // If you are in ssg mode, just rebuild the static pages and quit immediately.
        {
            await SSG();
            return;
        }
    }
    
    const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
    if (!roomSearchResult.success)
        return;

    if (roomSearchResult.data.length == 0)
    {
        let success = await DBRoomUtil.createRoom("hub", RoomTypeEnumMap.Hub, "", 0, 1, 2, `${dev ? `http://${AddressUtil.getLocalIpAddress()}:${LOCALHOST_PORT}` : URL_STATIC}/app/assets/texture_packs/default.jpg`);
        if (!success)
            return;
    }

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
    server.listen(dev ? LOCALHOST_PORT : process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${LOCALHOST_PORT}.`);
    });
    
    // socket connection
    Sockets(server);
}

Server();

// Prevent automatic restart when the server app crashes (only on dev mode)
if (dev)
    setInterval(() => {}, 36000000);