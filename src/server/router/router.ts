import path from "path";
import express from "express";
import { Express, Request, Response } from "express";
import PageRouter from "./ui/pageRouter";
import PopupRouter from "./ui/popupRouter";
import AuthRouter from "./api/authRouter";
import RoomRouter from "./api/roomRouter";
import SearchRouter from "./api/searchRouter";
import FileUtil from "../util/fileUtil";
import EJSUtil from "../util/ejsUtil";

export default function Router(app: Express): void
{
    app.use("/popup", PopupRouter);
    app.use("/api/auth", AuthRouter);
    app.use("/api/search", SearchRouter);
    app.use("/api/room", RoomRouter);
    app.use("/", PageRouter);

    // If you are in dev mode, serve static files dynamically.
    // The purpose of doing this is to replace the production-mode URLs ("http://thingspool...") with their local counterparts ("http://localhost..."), etc.
    if (process.env.MODE == "dev")
    {
        app.get(/.*\.html$/, async (req: Request, res: Response): Promise<void> => {
            const staticContent = await FileUtil.read(req.url);
            res.status(200).setHeader("content-type", "text/html")
                .send(EJSUtil.postProcessHTML(staticContent));
        });
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.pdf)$/, async (req: Request, res: Response): Promise<void> => {
            res.sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
    }
    express.static(path.join(process.env.PWD as string, process.env.STATIC_PAGE_ROOT_DIR as string));
}