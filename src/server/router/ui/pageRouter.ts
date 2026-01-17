import UserManager from "../../user/userManager";
import EJSUtil from "../../ssg/util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import dotenv from "dotenv";
import { ArcadeData } from "../../ssg/data/arcadeData";
dotenv.config();

const PageRouter = express.Router();

PageRouter.get("/mypage", UserManager.authenticateAnyUser, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", {
        loginDestination: `${process.env.URL_DYNAMIC}/mypage`,
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
        EJSUtil.render(req, res, "page/development/test_ui", {
            gameEntries: ArcadeData.gameEntries
        });
    });

    PageRouter.get("/tailwind_test", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/tailwind_test", {
            loginDestination: `${process.env.URL_DYNAMIC}/tailwind_test`,
        });
    });
}
else
{
    PageRouter.get("/admin", UserManager.authenticateAdmin, (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/admin", {});
    });

    PageRouter.get("/console", UserManager.authenticateAdmin, (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/console", {});
    });
}

export default PageRouter;