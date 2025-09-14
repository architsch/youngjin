import { Express, Request, Response } from "express";
import PageRouter from "./ui/pageRouter";
import AuthRouter from "./api/authRouter";
//import RoomRouter from "./api/roomRouter";
//import AdminRouter from "./api/adminRouter";
//import SearchRouter from "./api/searchRouter";
import FileUtil from "../util/fileUtil";
import EJSUtil from "../util/ejsUtil";

export default function Router(app: Express): void
{
    // If you are in dev mode, also emulate the behavior of the static web server.
    if (process.env.MODE == "dev")
    {
        app.get("/", async (req: Request, res: Response): Promise<void> => {
            const staticContent = await FileUtil.read(req.url + "index.html");
            res.status(200).setHeader("content-type", "text/html")
                .send(EJSUtil.postProcessHTML(staticContent));
        });
        app.get(/.*\.html$/, async (req: Request, res: Response): Promise<void> => {
            const staticContent = await FileUtil.read(req.url);
            res.status(200).setHeader("content-type", "text/html")
                .send(EJSUtil.postProcessHTML(staticContent));
        });
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.pdf)$/, async (req: Request, res: Response): Promise<void> => {
            res.sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
    }
    
    app.use("/api/auth", AuthRouter);
    //app.use("/api/search", SearchRouter);
    //app.use("/api/room", RoomRouter);
    //app.use("/api/admin", AdminRouter);
    app.use("/", PageRouter);
}