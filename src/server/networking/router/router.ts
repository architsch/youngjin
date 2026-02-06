import { Express, Request, Response } from "express";
import PageRouter from "./ui/pageRouter";
import UserRouter from "./api/userRouter";
import FileUtil from "../../ssg/util/fileUtil";
import EJSUtil from "../../ssg/util/ejsUtil";
import { USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

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
        app.get(/.*\.js$/, async (req: Request, res: Response): Promise<void> => {
            res.status(200).setHeader("content-type", "text/javascript")
                .sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.pdf)|(.*\.glb)$/, async (req: Request, res: Response): Promise<void> => {
            res.sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
    }
    else
    {
        // Respond to Google's health check (Firebase App Hosting)
        app.get("/", (req: Request, res: Response) => {
            res.status(200).send("Server is running");
        });
    }
    
    app.get("/robots.txt", (req: Request, res: Response) => {
        res.type("text/plain");
        res.send("User-agent: *\nDisallow: /socket.io/");
    });

    app.use(`/${USER_API_ROUTE_PATH}`, UserRouter);
    app.use("/", PageRouter);
}