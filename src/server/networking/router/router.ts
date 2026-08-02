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
    // If you are in dev mode, also emulate the behavior of the static web server.
    // Note: "/" is intentionally NOT registered here — PageRouter handles it as the
    // game page. Static "index.html" remains reachable via "/index.html".
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
        // The dev build's source map. It lives beside the bundle instead of inside it, so unlike
        // the bundle it needs a route of its own — the ".js" rule below does not cover it.
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
        app.get(/(.*\.css)|(.*\.jpg)|(.*\.png)|(.*\.webp)|(.*\.svg)|(.*\.ico)|(.*\.atom)|(.*\.xml)|(.*\.txt)|(.*\.json)|(.*\.pdf)|(.*\.glb)$/, async (req: Request, res: Response): Promise<void> => {
            res.sendFile(FileUtil.getAbsoluteFilePath(req.url));
        });
    }

    // Health check endpoint. Reaching it at all means this process is past its startup work and
    // listening, so the only thing left to report is whether it is on its way out. A shutting-down
    // process answers "not ready", so that a client waiting for the next deployment's server keeps
    // waiting instead of reloading into a process that is about to stop listening.
    //
    // A ready process also names the build it is running. That is what lets a page which has been
    // sitting in a background tab across a deployment discover that it is running code the server
    // has since moved on from — the one thing no amount of reconnecting can tell it.
    app.get(`/${HEALTH_ROUTE_PATH}`, (req: Request, res: Response) => {
        if (ServerLifecycleUtil.isShuttingDown())
        {
            res.status(503).set("Cache-Control", "no-store").send("Server is shutting down");
            return;
        }
        res.status(200).set("Cache-Control", "no-store")
            .json({ status: "Server is running", gitCommit: GIT_COMMIT });
    });

    // Only the public deployment invites crawlers at all. Staging answers on an address of its own
    // while serving the very same pages, so anything indexed there becomes a second copy of the
    // site competing with the real one — which is worth refusing outright rather than untangling
    // afterwards. The socket endpoint is never worth crawling in either case.
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