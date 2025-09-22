import AuthUtil from "../../util/authUtil";
import RoomDB from "../../db/roomDB";
import NetworkUtil from "../../util/networkUtil";
import express from "express";
import { Request, Response } from "express";
import TextUtil from "../../../shared/util/textUtil";
import DebugUtil from "../../util/debugUtil";
import UIConfig from "../../../shared/config/uiConfig";
import User from "../../db/types/schema/user";

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
RoomRouter.post("/create", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
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
});
// req.body = {roomID}
RoomRouter.delete("/delete", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.deleteRoom(req.body.roomID, user.userName, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID}
RoomRouter.delete("/leave", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.leaveRoom(req.body.roomID, user.userName, res);
    NetworkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for rooms.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID}
RoomRouter.put("/accept-invitation", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.acceptInvitation(req.body.roomID, user.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID}
RoomRouter.delete("/ignore-invitation", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.ignoreInvitation(req.body.roomID, user.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID}
RoomRouter.post("/request-to-join", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.requestToJoin(req.body.roomID, user.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID}
RoomRouter.delete("/cancel-request", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.cancelRequest(req.body.roomID, user.userID, res);
    NetworkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for roomMembers.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID, userID}
RoomRouter.post("/invite", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.invite(req.body.roomID, user.userName, req.body.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
RoomRouter.delete("/cancel-invite", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.cancelInvite(req.body.roomID, user.userName, req.body.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
RoomRouter.put("/accept-request", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.acceptRequest(req.body.roomID, user.userName, req.body.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
RoomRouter.delete("/ignore-request", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.ignoreRequest(req.body.roomID, user.userName, req.body.userID, res);
    NetworkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
RoomRouter.delete("/kickout", AuthUtil.authenticateRegisteredUser, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await RoomDB.kickout(req.body.roomID, user.userName, req.body.userID, res);
    NetworkUtil.onRouteResponse(res);
});

export default RoomRouter;