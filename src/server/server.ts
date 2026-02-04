import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import SSG from "./ssg/ssg";
import Router from "./router/router";
import Sockets from "./sockets/sockets";
import DBRoomUtil from "./db/util/dbRoomUtil";
import { RoomTypeEnumMap } from "../shared/room/types/roomType";
import DBSearchUtil from "./db/util/dbSearchUtil";
import AddressUtil from "./networking/util/addressUtil";

async function Server(): Promise<void>
{
    console.log(`========================================
Env Variables in Server:
========================================
    MODE: ${process.env.MODE}
    SKIP_SSG: ${process.env.SKIP_SSG}
    PORT: ${process.env.PORT}
    SKIP_CSS_COMPILE: ${process.env.SKIP_CSS_COMPILE}
    SKIP_CLIENT_COMPILE: ${process.env.SKIP_CLIENT_COMPILE}
    SKIP_SERVER_COMPILE: ${process.env.SKIP_SERVER_COMPILE}
========================================`);

    const dev = process.env.MODE == "dev";

    // SSG = "Static Site Generator"
    if (process.env.SKIP_SSG != "true")
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

    if (!process.env.JWT_SECRET_KEY)
    {
        console.error("[Premature Server Termination] :: Secret not found :: JWT_SECRET_KEY");
        return;
    }
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID)
    {
        console.error("[Premature Server Termination] :: Secret not found :: GOOGLE_OAUTH_CLIENT_ID");
        return;
    }
    if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    {
        console.error("[Premature Server Termination] :: Secret not found :: GOOGLE_OAUTH_CLIENT_SECRET");
        return;
    }

    const roomSearchResult = await DBSearchUtil.rooms.withRoomType(RoomTypeEnumMap.Hub);
    if (!roomSearchResult.success)
    {
        console.error("[Premature Server Termination] :: Failed to search for hub rooms.");
        return;
    }

    if (roomSearchResult.data.length == 0)
    {
        let result = await DBRoomUtil.createRoom("hub", RoomTypeEnumMap.Hub, "", 0, 1, 2, `${AddressUtil.getEnvStaticURL()}/app/assets/texture_packs/default.jpg`);
        if (!result.success)
        {
            console.error("[Premature Server Termination] :: Failed to create a hub room.");
            return;
        }
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
    server.listen(process.env.PORT, () => {
        console.log("---------------------------------------------");
        console.log(`Listening to port ${process.env.PORT}.`);
    });
    
    // socket connection
    Sockets(server);
}

Server();