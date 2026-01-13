import AuthUtil from "../../util/authUtil";
import RoomDB from "../../db/roomDB";
import NetworkUtil from "../../util/networkUtil";
import express from "express";
import { Request, Response } from "express";
import TextUtil from "../../../shared/embeddedScripts/util/textUtil";
import DebugUtil from "../../util/debugUtil";
import UIConfig from "../../../shared/embeddedScripts/config/uiConfig";
import User from "../../../shared/auth/types/user";

const RoomRouter = express.Router();

const validateUser = (req: Request, res: Response): User | null => {
    const user = (req as any).user;
    if (!user)
    {
        res.status(404).send("User not found.");
        return null;
    }
    return user;
};

//------------------------------------------------------------------------------------
// Core
//------------------------------------------------------------------------------------

// req.body = {roomName}
/*RoomRouter.post("/create", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    const roomNameError = TextUtil.findErrorInRoomName(req.body.roomName);
    if (roomNameError != null)
    {
        DebugUtil.log("UserName Input Error", {userName: req.body.roomName, roomNameError}, "high", "pink");
        res.status(400).send(UIConfig.displayText.message[roomNameError]);
        return;
    }
    await RoomDB.createRoom(req.body.roomName, user.userName, res);
    NetworkUtil.onRouteResponse(res);
});*/
// req.body = {roomID}
/*RoomRouter.delete("/delete", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.deleteRoom(req.body.roomID, user.userName, res);
    NetworkUtil.onRouteResponse(res);
});*/

export default RoomRouter;