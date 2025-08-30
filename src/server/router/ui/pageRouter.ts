import RoomDB from "../../db/roomDB";
import AuthUtil from "../../util/authUtil";
import EJSUtil from "../../util/ejsUtil";
import express from "express";
import { Request, Response } from "express";

const PageRouter = express.Router();

//------------------------------------------------------------------------------------
// menu pages
//------------------------------------------------------------------------------------

PageRouter.get("/", AuthUtil.authenticateTokenOptional, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/menu/index", {
        loginDestination: "",
    });
});

// query strings = {tabname(optional)}
PageRouter.get("/rooms", AuthUtil.authenticateTokenOptional, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/menu/rooms", {
        loginDestination: "rooms",
        tabName: req.query.tabname ? req.query.tabname : "owned",
    });
});

PageRouter.get("/arcade", (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/menu/arcade", {});
});

PageRouter.get("/library", (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/menu/library", {});
});

PageRouter.get("/admin", AuthUtil.authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    if (user && user.userType == "admin")
        EJSUtil.render(req, res, "page/menu/admin", {});
    else
        res.status(403).send("Only the admin can access this page.");
});

//------------------------------------------------------------------------------------
// form pages
//------------------------------------------------------------------------------------

PageRouter.get("/register", (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/form/register", {
        registerDestination: "",
    });
});

//------------------------------------------------------------------------------------
// private pages
//------------------------------------------------------------------------------------

// query strings = {roomid}
PageRouter.get("/room", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;
    if (!user)
    {
        res.status(404).send("User not found.");
        return;
    }
    const roomContents = await RoomDB.getRoomContent(req.query.roomid as string, user.userID, res);
    if (res.statusCode < 200 || res.statusCode >= 300)
        return;
    const roomContent = roomContents[0];

    EJSUtil.render(req, res, "page/private/room", {
        roomID: req.query.roomid,
        roomContent,
        title: roomContent.roomName,
        desc: roomContent.roomName,
        keywords: undefined,
    });
});

//------------------------------------------------------------------------------------
// misc pages
//------------------------------------------------------------------------------------

PageRouter.get("/console", AuthUtil.authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    if (user && user.userType == "admin")
        EJSUtil.render(req, res, "page/misc/console", {});
    else
        res.status(403).send("Only the admin can access this page.");
});

PageRouter.get("/test-ui", (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "page/misc/test_ui", {
        loginDestination: "",
        registerDestination: "",
    });
});

export default PageRouter;