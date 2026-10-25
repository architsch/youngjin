import EJSUtil from "../../../ssg/util/ejsUtil";
import express from "express";
import { Request, Response } from "express";
import { ArcadeData } from "../../../ssg/data/arcadeData";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import { AGENT_CAMERA_ROUTE_PATH, GIT_COMMIT } from "../../../system/serverConstants";
import AgentCameraUtil from "../../../agent/util/agentCameraUtil";
import RoomIdUtil from "../../../../shared/room/util/roomIdUtil";
import SignInProviderMap from "../../../user/maps/signInProviderMap";

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

// An agent's camera, which no session goes with (see AgentCameraUtil).
PageRouter.get(`/${AGENT_CAMERA_ROUTE_PATH}/:token`, AgentCameraUtil.servePage);

PageRouter.get("/", UserIdentificationUtil.identifyAnyUserUnlessBot, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: "",
        signInProviders: SignInProviderMap.getOfferedIDs() });
});

PageRouter.get("/:roomID", rejectMalformedRoomID, UserIdentificationUtil.identifyAnyUserUnlessBot,
    (req: Request, res: Response): void => {
        EJSUtil.render(req, res, "page/dynamic/mypage", { gitCommit: GIT_COMMIT, targetRoomID: req.params.roomID,
            signInProviders: SignInProviderMap.getOfferedIDs() });
    });

// Rejects non-room-shaped paths (favicon, scanner probes) before identification, which would otherwise
// create a guest and a Firestore write each. Also makes the ID safe to embed in the page URL.
function rejectMalformedRoomID(req: Request, res: Response, next: () => void): void
{
    const roomID = req.params.roomID;
    if (typeof roomID != "string" || !RoomIdUtil.isRoomID(roomID))
    {
        res.status(404).send("Page not found");
        return;
    }
    next();
}

export default PageRouter;