import { Express, Request, Response } from "express";
import PageRouter from "./ui/pageRouter";
import UserRouter from "./api/userRouter";
import RoomRouter from "./api/roomRouter";
import FileUtil from "../../ssg/util/fileUtil";
import EJSUtil from "../../ssg/util/ejsUtil";
import { USER_API_ROUTE_PATH, ROOM_API_ROUTE_PATH, HEALTH_ROUTE_PATH } from "../../../shared/system/sharedConstants";
import RateLimitUtil from "../util/rateLimitUtil";
import ServerLifecycleUtil from "../../system/util/serverLifecycleUtil";
import { GIT_COMMIT, IS_PUBLIC_SITE } from "../../system/serverConstants";

export default function Router(app: Express): void
{
    // Dev mode emulates the static web server. "/" is left to PageRouter (the game page);
    // index.html remains at "/index.html".
    if (process.env.MODE == "dev")
    {
        app.get(/.*\.html$/, async (req: Request, res: Response): Promise<void> => {
            const staticContent = await FileUtil.read(req.url);
            res.status(200).setHeader("content-type", "text/html")
                .send(EJSUtil.postProcessHTML(staticContent));
        });
        // Client bundles are built to dist/client/, not public/
        app.get("/app/bundle.js", (req: Request, res: Response): void => {
            res.status(200).setHeader("content-type", "text/javascript")
                .sendFile(FileUtil.getAbsoluteFilePath("bundle.js", "dist/client"));
        });
        // The dev source map sits beside the bundle, so it needs its own route.
        app.get("/app/bundle.js.map", (req: Request, res: Response): void => {
            res.sendFile(FileUtil.getAbsoluteFilePath("bundle.js.map", "dist/client"));
        });
        app.get("/app/style.css", (req: Request, res: Response): void => {
            res.sendFile(FileUtil.getAbsoluteFilePath("style.css", "dist/client"));
        });
        app.get(/.*\.js$/, async (req: Request, res: Response): Promise<void> => {
            res.status(200).setHeader("content-type", "text/javascript")
                .sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.webp)|(.*\.svg)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.txt)|(.*\.json)|(.*\.pdf)$/, async (req: Request, res: Response): Promise<void> => {
            res.sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
    }

    // Health check: not ready while shutting down (so waiting clients don't reload into a dying
    // process). A ready response includes the git commit, so stale pages can detect a newer build.
    app.get(`/${HEALTH_ROUTE_PATH}`, (req: Request, res: Response) => {
        if (ServerLifecycleUtil.isShuttingDown())
        {
            res.status(503).set("Cache-Control", "no-store").send("Server is shutting down");
            return;
        }
        res.status(200).set("Cache-Control", "no-store")
            .json({ status: "Server is running", gitCommit: GIT_COMMIT });
    });

    // Only the public site allows crawling (staging would duplicate it). The socket endpoint is never
    // crawlable.
    app.get("/robots.txt", (req: Request, res: Response) => {
        res.type("text/plain");
        res.send(IS_PUBLIC_SITE ? "User-agent: *\nDisallow: /socket.io/" : "User-agent: *\nDisallow: /");
    });

    // Debug endpoint to check server connectivity and headers
    app.get("/debug-connection", (req: Request, res: Response) => {
        res.json({
            status: "ok",
            headers: req.headers,
            secure: req.secure,
            protocol: req.protocol,
            hostname: req.hostname,
            ip: req.ip,
            ips: req.ips,
            timestamp: new Date().toISOString()
        });
    });

    app.use(`/${USER_API_ROUTE_PATH}`, RateLimitUtil.apiRateLimiter, UserRouter);
    app.use(`/${ROOM_API_ROUTE_PATH}`, RateLimitUtil.apiRateLimiter, RoomRouter);
    app.use("/", RateLimitUtil.pageRateLimiter, PageRouter);
}