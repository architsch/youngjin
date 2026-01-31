import EJSUtil from "../../ssg/util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import { ArcadeData } from "../../ssg/data/arcadeData";
import UserIdentificationUtil from "../../user/util/userIdentificationUtil";

const PageRouter = express.Router();

PageRouter.get("/mypage", UserIdentificationUtil.identifyAnyUser, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", {});
});

if (process.env.MODE == "dev")
{
    PageRouter.get("/console", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/console", {});
    });

    PageRouter.get("/test-ui", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/test_ui", {
            gameEntries: ArcadeData.gameEntries
        });
    });

    PageRouter.get("/tailwind_test", (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/tailwind_test", {});
    });
}
else
{
    PageRouter.get("/console", UserIdentificationUtil.identifyAdmin, (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/development/console", {});
    });
}

export default PageRouter;