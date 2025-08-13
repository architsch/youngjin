import path from "path";
import express from "express";
import { Express } from "express";
import GlobalConfig from "../../Shared/Config/GlobalConfig";
import PageRouter from "./UI/PageRouter";
import PopupRouter from "./UI/PopupRouter";
import AuthRouter from "./API/AuthRouter";
import RoomRouter from "./API/RoomRouter";
import SearchRouter from "./API/SearchRouter";

export default function Router(app: Express): void
{
    if (!GlobalConfig.page.bypassDynamicPages)
        app.use("/", PageRouter);
    app.use("/popup", PopupRouter);
    app.use("/api/auth", AuthRouter);
    app.use("/api/search", SearchRouter);
    app.use("/api/room", RoomRouter);
    app.use(express.static(path.join(process.env.PWD as string, process.env.STATIC_PAGE_ROOT_DIR as string)));
}