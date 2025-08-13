import AuthUtil from "../../Util/AuthUtil";
import EJSUtil from "../../Util/EJSUtil";
import express from "express";
import { Request, Response } from "express";

const PopupRouter = express.Router();

PopupRouter.get("/create-room", AuthUtil.authenticateToken, (req: Request, res: Response): void => {
    res.render("popup/createRoom", EJSUtil.makeEJSParams(req, false, {}));
});

// query strings = {roomid, tabname(optional)}
PopupRouter.get("/room-members", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    res.render("popup/roomMembers", EJSUtil.makeEJSParams(req, false,
    {
        roomID: req.query.roomid,
        tabName: req.query.tabname ? req.query.tabname : "associated",
    }));
});

export default PopupRouter;