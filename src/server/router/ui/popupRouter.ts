import AuthUtil from "../../util/authUtil";
import EJSUtil from "../../util/ejsUtil";
import express from "express";
import { Request, Response } from "express";

const PopupRouter = express.Router();

PopupRouter.get("/create-room", AuthUtil.authenticateToken, (req: Request, res: Response): void => {
    EJSUtil.render(req, res, "popup/createRoom", {});
});

// query strings = {roomid, tabname(optional)}
PopupRouter.get("/room-members", AuthUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    EJSUtil.render(req, res, "popup/roomMembers", {
        roomID: req.query.roomid,
        tabName: req.query.tabname ? req.query.tabname : "associated",
    });
});

export default PopupRouter;