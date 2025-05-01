const authUtil = require("../util/authUtil.js");
const dbRoom = require("../db/dbRoom.js");
const networkUtil = require("../util/networkUtil.js");

const express = require("express");
const router = express.Router();

//------------------------------------------------------------------------------------
// Core
//------------------------------------------------------------------------------------

// req.body = {roomName}
router.post("/create", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.createRoom(res, req.body.roomName, req.user.userName);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/delete", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.deleteRoom(res, req.body.roomID, req.user.userName);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/leave", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.leaveRoom(res, req.body.roomID, req.user.userName);
    networkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for rooms.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID}
router.put("/accept-invitation", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.acceptInvitation(res, req.body.roomID, req.user.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/ignore-invitation", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.ignoreInvitation(res, req.body.roomID, req.user.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.post("/request-to-join", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.requestToJoin(res, req.body.roomID, req.user.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID}
router.delete("/cancel-request", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.cancelRequest(res, req.body.roomID, req.user.userID);
    networkUtil.onRouteResponse(res);
});

//------------------------------------------------------------------------------------
// API for roomMembers.ejs
//------------------------------------------------------------------------------------

// req.body = {roomID, userID}
router.post("/invite", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.invite(res, req.body.roomID, req.user.userName, req.body.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/cancel-invite", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.cancelInvite(res, req.body.roomID, req.user.userName, req.body.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.put("/accept-request", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.acceptRequest(res, req.body.roomID, req.user.userName, req.body.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/ignore-request", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.ignoreRequest(res, req.body.roomID, req.user.userName, req.body.userID);
    networkUtil.onRouteResponse(res);
});
// req.body = {roomID, userID}
router.delete("/kickout", authUtil.authenticateToken, async (req, res) => {
    await dbRoom.kickout(res, req.body.roomID, req.user.userName, req.body.userID);
    networkUtil.onRouteResponse(res);
});

module.exports = router;