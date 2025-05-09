const authUtil = require("../util/authUtil.js");
const networkUtil = require("../util/networkUtil.js");
const dbSearch = require("../db/dbSearch.js");

const express = require("express");
const router = express.Router();

//------------------------------------------------------------------------------------
// Search for Rooms
//------------------------------------------------------------------------------------

// query strings: {page}
router.get("/rooms/owned", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichIOwn(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/joined", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichIJoined(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/invited", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichInvitedMe(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/requested", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichIRequestedToJoin(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/pending", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichIAmPendingToJoin(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/associated", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.whichIAmAssociatedWith(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {page}
router.get("/rooms/others", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.rooms.others(res, authUtil.getUserFromReqToken(req).userID, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

//------------------------------------------------------------------------------------
// Search for Users
//------------------------------------------------------------------------------------

// query strings: {roomid, page}
router.get("/users/joined", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.whoJoinedRoom(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/invited", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.whoAreInvitedToJoinRoom(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/requested", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.whoRequestedToJoinRoom(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/pending", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.whoArePendingToJoinRoom(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/associated", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.whoAreAssociatedWithRoom(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

// query strings: {roomid, page}
router.get("/users/others", authUtil.authenticateToken, async (req, res) => {
    const results = await dbSearch.users.others(res, req.query.roomid, req.query.page);
    networkUtil.onRouteResponse(res, results);
});

module.exports = router;