import authUtil from "../util/authUtil";
import ejsUtil from "../util/ejsUtil";
import express from "express";
import { Request, Response } from "express";

const router = express.Router();

router.get("/create-room", authUtil.authenticateToken, (req: Request, res: Response): void => {
    res.render("popup/createRoom", ejsUtil.makeEJSParams(req, false, {}));
});

// query strings = {roomid, tabname(optional)}
router.get("/room-members", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    res.render("popup/roomMembers", ejsUtil.makeEJSParams(req, false,
    {
        roomID: req.query.roomid,
        tabName: req.query.tabname ? req.query.tabname : "associated",
    }));
});

export default router;