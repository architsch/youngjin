import EJSUtil from "../../../ssg/util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import { ArcadeData } from "../../../ssg/data/arcadeData";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import { GIT_COMMIT } from "../../../system/serverConstants";

const PageRouter = express.Router();

// Specific named routes are registered before the catch-all "/:roomID" so they
// are matched first (e.g. "/console" must not be interpreted as a room ID).
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

PageRouter.get("/", UserIdentificationUtil.identifyAnyUser, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: "" });
});

PageRouter.get("/:roomID", UserIdentificationUtil.identifyAnyUser, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: req.params.roomID });
});

export default PageRouter;