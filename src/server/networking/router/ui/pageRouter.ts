import EJSUtil from "../../../ssg/util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import { ArcadeData } from "../../../ssg/data/arcadeData";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import { GIT_COMMIT } from "../../../system/serverConstants";

const PageRouter = express.Router();

// Named routes come before the "/:roomID" catch-all.
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

PageRouter.get("/", UserIdentificationUtil.identifyAnyUserUnlessBot, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: "" });
});

PageRouter.get("/:roomID", rejectMalformedRoomID, UserIdentificationUtil.identifyAnyUserUnlessBot,
    (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: req.params.roomID });
    });

// Firestore document IDs: exactly 20 alphanumeric characters.
const ROOM_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

// Rejects non-room-shaped paths (favicon, scanner probes) before identification, which would otherwise
// create a guest and a Firestore write each. Also makes the ID safe to embed in the page URL.
function rejectMalformedRoomID(req: Request, res: Response, next: () => void): void
{
    const roomID = req.params.roomID;
    if (typeof roomID != "string" || !ROOM_ID_PATTERN.test(roomID))
    {
        res.status(404).send("Page not found");
        return;
    }
    next();
}

export default PageRouter;