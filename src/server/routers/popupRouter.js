const authUtil = require("../util/authUtil.js");
const ejsUtil = require("../util/ejsUtil.js");

const express = require("express");
const router = express.Router();

router.get("/create-room", authUtil.authenticateToken, (req, res) => {
    res.render("popup/createRoom", ejsUtil.makeEJSParams(req, false, {}));
});

// query strings = {roomid, tabname(optional)}
router.get("/room-members", authUtil.authenticateToken, async (req, res) => {
    res.render("popup/roomMembers", ejsUtil.makeEJSParams(req, false,
    {
        roomID: req.query.roomid,
        tabName: req.query.tabname ? req.query.tabname : "associated",
    }));
});

module.exports = router;