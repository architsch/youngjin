import authUtil from "../util/authUtil";
import dbRoom from "../db/dbRoom";
import networkUtil from "../util/networkUtil";
import express from "express";
import { Request, Response } from "express";

const router = express.Router();

const validateUser = (req: Request, res: Response): user | null => {
    const user = authUtil.getUserFromReqToken(req);
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
router.post("/create", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.createRoom(req.body.roomName, user.userName, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/delete", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.deleteRoom(req.body.roomID, user.userName, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/leave", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.leaveRoom(req.body.roomID, user.userName, res);
    networkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for rooms.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID}
router.put("/accept-invitation", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.acceptInvitation(req.body.roomID, user.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/ignore-invitation", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.ignoreInvitation(req.body.roomID, user.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.post("/request-to-join", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.requestToJoin(req.body.roomID, user.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/cancel-request", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.cancelRequest(req.body.roomID, user.userID, res);
    networkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for roomMembers.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID, userID}
router.post("/invite", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.invite(req.body.roomID, user.userName, req.body.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/cancel-invite", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.cancelInvite(req.body.roomID, user.userName, req.body.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.put("/accept-request", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.acceptRequest(req.body.roomID, user.userName, req.body.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/ignore-request", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.ignoreRequest(req.body.roomID, user.userName, req.body.userID, res);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/kickout", authUtil.authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const user = validateUser(req, res);
    if (!user)
        return;
    await dbRoom.kickout(req.body.roomID, user.userName, req.body.userID, res);
    networkUtil.onRouteResponse(res);
});

export default router;