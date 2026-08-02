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

PageRouter.get("/", UserIdentificationUtil.identifyAnyUserUnlessBot, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: "" });
});

PageRouter.get("/:roomID", rejectMalformedRoomID, UserIdentificationUtil.identifyAnyUserUnlessBot,
    (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: req.params.roomID });
    });

// Room IDs are Firestore document IDs, which are always exactly this many characters drawn from
// this one alphabet.
const ROOM_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

// Everything the server is asked for that is not one of its own routes lands on the room route,
// since a room address is just a name at the root. That includes a browser's unbidden
// "/favicon.ico" and the steady background traffic of scanners trying "/wp-login.php", "/.env" and
// the like. A room address has exactly one shape, so anything of another shape is turned away here
// — before it reaches the identification step, where it would otherwise have cost a guest account
// and a Firestore write apiece. Checking the shape also leaves the ID safe to place into the URL
// that the page advertises as its own.
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