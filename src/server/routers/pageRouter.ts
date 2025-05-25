import dbRoom from "../db/dbRoom";
import authUtil from "../util/authUtil";
import ejsUtil from "../util/ejsUtil";
import envUtil from "../util/envUtil";
import globalConfig from "../config/globalConfig";
import express from "express";
import { Request, Response } from "express";

const router = express.Router();

const dev = envUtil.isDevMode();

//------------------------------------------------------------------------------------
// menu pages
//------------------------------------------------------------------------------------

router.get("/", authUtil.authenticateTokenOptional, async (req: Request, res: Response): Promise<void> => {
    res.render("page/menu/index", ejsUtil.makeEJSParams(req, true,
    {
        loginDestination: "",
        embeddedScripts: ["util/textUtil.ejs"],
    }));
});

// query strings = {tabname(optional)}
router.get("/rooms.html", authUtil.authenticateTokenOptional, async (req: Request, res: Response): Promise<void> => {
    res.render("page/menu/rooms", ejsUtil.makeEJSParams(req, false,
    {
        loginDestination: "rooms.html",
        embeddedScripts: ["util/textUtil.ejs"],
        tabName: req.query.tabname ? req.query.tabname : "owned",
        searchLimitPerPage: globalConfig.search.searchLimitPerPage,
    }));
});

//------------------------------------------------------------------------------------
// form pages
//------------------------------------------------------------------------------------

router.get("/register", (req: Request, res: Response): void => {
    res.render("page/form/register", ejsUtil.makeEJSParams(req, true,
    {
        registerDestination: "",
        embeddedScripts: ["util/textUtil.ejs"],
    }));
});

//------------------------------------------------------------------------------------
// private pages
//------------------------------------------------------------------------------------

// query strings = {roomid}
router.get("/room", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = authUtil.getUserFromReqToken(req);
    if (!user)
    {
        res.status(404).send("User not found.");
        return;
    }
    const roomContents = await dbRoom.getRoomContent(req.query.roomid as string, user.userID, res);
    if (res.statusCode < 200 || res.statusCode >= 300)
        return;
    const roomContent = roomContents[0];

    res.render("page/private/room", ejsUtil.makeEJSParams(req, false,
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
    router.get("/console", (req: Request, res: Response): void => {
        res.render("page/misc/console", ejsUtil.makeEJSParams(req, true, {}));
    });

    router.get("/test-ui", (req: Request, res: Response): void => {
        res.render("page/misc/test_ui", ejsUtil.makeEJSParams(req, true,
        {
            loginDestination: "",
            registerDestination: "",
            embeddedScripts: ["util/textUtil.ejs"],
        }));
    });
}

export default router;