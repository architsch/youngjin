const dbRoom = require("../db/dbRoom.js");
const authUtil = require("../util/authUtil.js");
const ejsUtil = require("../util/ejsUtil.js");
const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;

const express = require("express");
const router = express.Router();

//------------------------------------------------------------------------------------
// menu pages
//------------------------------------------------------------------------------------

router.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/menu/index", ejsUtil.makeEJSParams(
        {user: req.user, loginDestination: ""}));
});

// query strings = {tabname(optional)}
router.get("/rooms.html", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/menu/rooms", ejsUtil.makeEJSParams({
        user: req.user,
        loginDestination: "rooms.html",
        tabName: req.query.tabname ? req.query.tabname : "owned",
        searchLimitPerPage: globalConfig.search.searchLimitPerPage,
    }));
});

//------------------------------------------------------------------------------------
// form pages
//------------------------------------------------------------------------------------

router.get("/register", (req, res) => {
    res.render("page/form/register", ejsUtil.makeEJSParams(
        {user: req.user, registerDestination: ""}));
});

//------------------------------------------------------------------------------------
// private pages
//------------------------------------------------------------------------------------

// query strings = {roomid}
router.get("/room", authUtil.authenticateToken, async (req, res) => {
    const roomContent = await dbRoom.getRoomContent(res, req.query.roomid, req.user.userID);
    if (res.statusCode < 200 || res.statusCode >= 300)
        return;
    res.render("page/private/room", ejsUtil.makeEJSParams({
        user: req.user,
        roomID: req.query.roomid,
        roomContent: roomContent,
        title: roomContent.roomName,
        desc: roomContent.roomName,
        keywords: undefined,
    }));
});

module.exports = router;