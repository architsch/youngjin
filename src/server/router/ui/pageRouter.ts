import AuthUtil from "../../util/authUtil";
import EJSUtil from "../../util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const PageRouter = express.Router();

PageRouter.get("/mypage", AuthUtil.authenticateAnyUser, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", {
        loginDestination: `${process.env.URL_DYNAMIC}/mypage`,
    });
});

PageRouter.get("/register", (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/register", {
        registerDestination: `${process.env.URL_DYNAMIC}/mypage`,
    });
});

PageRouter.get("/chat", AuthUtil.authenticateAnyUser, async (req: Request, res: Response): Promise<void> => {
    EJSUtil.render(req, res, "page/dynamic/chat", {
        title: "Chat",
        desc: "This is ThingsPool's chat room.",
        keywords: undefined,
    });
});

if (process.env.MODE == "dev")
{
    PageRouter.get("/admin", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/admin", {});
    });

    PageRouter.get("/console", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/console", {});
    });

    PageRouter.get("/test-ui", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/test_ui", {});
    });
}
else
{
    PageRouter.get("/admin", AuthUtil.authenticateAdmin, (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/admin", {});
    });

    PageRouter.get("/console", AuthUtil.authenticateAdmin, (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/console", {});
    });
}

export default PageRouter;