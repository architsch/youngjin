const dbRoom = require("../db/dbRoom.js");
const authUtil = require("../util/authUtil.js");
const ejsUtil = require("../util/ejsUtil.js");
const envUtil = require("../util/envUtil.js");
const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;

const express = require("express");
const router = express.Router();

const dev = envUtil.isDevMode();

//------------------------------------------------------------------------------------
// menu pages
//------------------------------------------------------------------------------------

router.get("/", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/menu/index", ejsUtil.makeEJSParams(req, true,
        {loginDestination: ""}));
});

// query strings = {tabname(optional)}
router.get("/rooms.html", authUtil.authenticateTokenOptional, async (req, res) => {
    res.render("page/menu/rooms", ejsUtil.makeEJSParams(req, false,
    {
        loginDestination: "rooms.html",
        tabName: req.query.tabname ? req.query.tabname : "owned",
        searchLimitPerPage: globalConfig.search.searchLimitPerPage,
    }));
});

//------------------------------------------------------------------------------------
// form pages
//------------------------------------------------------------------------------------

router.get("/register", (req, res) => {
    res.render("page/form/register", ejsUtil.makeEJSParams(req, true,
        {registerDestination: ""}));
});

//------------------------------------------------------------------------------------
// private pages
//------------------------------------------------------------------------------------

// query strings = {roomid}
router.get("/room", authUtil.authenticateToken, async (req, res) => {
    const user = authUtil.getUserFromReqToken(req);
    const roomContent = await dbRoom.getRoomContent(res, req.query.roomid, user.userID);
    if (res.statusCode < 200 || res.statusCode >= 300)
        return;
    res.render("page/private/room", ejsUtil.makeEJSParams(req, false,
    {
        roomID: req.query.roomid,
        roomContent: roomContent,
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
    router.get("/console", (req, res) => {
        res.render("page/misc/console", ejsUtil.makeEJSParams(req, true, {}));
    });

    router.get("/ui-test", (req, res) => {
        res.render("page/misc/uiTest", ejsUtil.makeEJSParams(req, true,
            {loginDestination: "", registerDestination: ""}));
    });
}

module.exports = router;