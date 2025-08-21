import path from "path";
import express from "express";
import { Express } from "express";
import GlobalConfig from "../../shared/config/globalConfig";
import PageRouter from "./ui/pageRouter";
import PopupRouter from "./ui/popupRouter";
import AuthRouter from "./api/authRouter";
import RoomRouter from "./api/roomRouter";
import SearchRouter from "./api/searchRouter";

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