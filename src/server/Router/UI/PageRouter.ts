import RoomDB from "../../DB/RoomDB";
import AuthUtil from "../../Util/AuthUtil";
import EJSUtil from "../../Util/EJSUtil";
import EnvUtil from "../../Util/EnvUtil";
import express from "express";
import { Request, Response } from "express";

const PageRouter = express.Router();

const dev = EnvUtil.isDevMode();

//------------------------------------------------------------------------------------
// menu pages
//------------------------------------------------------------------------------------

PageRouter.get("/", AuthUtil.authenticateTokenOptional, async (req: Request, res: Response): Promise<void> => {
    res.render("page/menu/index", EJSUtil.makeEJSParams(req, true,
    {
        loginDestination: "",
    }));
});

// query strings = {tabname(optional)}
PageRouter.get("/rooms.html", AuthUtil.authenticateTokenOptional, async (req: Request, res: Response): Promise<void> => {
    res.render("page/menu/rooms", EJSUtil.makeEJSParams(req, false,
    {
        loginDestination: "rooms.html",
        tabName: req.query.tabname ? req.query.tabname : "owned",
    }));
});

//------------------------------------------------------------------------------------
// form pages
//------------------------------------------------------------------------------------

PageRouter.get("/register", (req: Request, res: Response): void => {
    res.render("page/form/register", EJSUtil.makeEJSParams(req, true,
    {
        registerDestination: "",
    }));
});

//------------------------------------------------------------------------------------
// private pages
//------------------------------------------------------------------------------------

// query strings = {roomid}
PageRouter.get("/room", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = AuthUtil.getUserFromReqToken(req);
    if (!user)
    {
        res.status(404).send("User not found.");
        return;
    }
    const roomContents = await RoomDB.getRoomContent(req.query.roomid as string, user.userID, res);
    if (res.statusCode < 200 || res.statusCode >= 300)
        return;
    const roomContent = roomContents[0];

    res.render("page/private/room", EJSUtil.makeEJSParams(req, false,
    {
        roomID: req.query.roomid,
        roomContent,
        title: roomContent.roomName,
        desc: roomContent.roomName,
        keywords: undefined,
    }));
});

//------------------------------------------------------------------------------------
// misc pages
//------------------------------------------------------------------------------------

if (dev)
{
    PageRouter.get("/console", (req: Request, res: Response): void => {
        res.render("page/misc/console", EJSUtil.makeEJSParams(req, true, {}));
    });

    PageRouter.get("/test-ui", (req: Request, res: Response): void => {
        res.render("page/misc/test_ui", EJSUtil.makeEJSParams(req, true,
        {
            loginDestination: "",
            registerDestination: "",
        }));
    });
}

export default PageRouter;