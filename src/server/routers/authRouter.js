const authUtil = require("../util/authUtil.js");
const emailUtil = require("../util/emailUtil.js");
const networkUtil = require("../util/networkUtil.js");

const express = require("express");
const router = express.Router();

// req.body = {userName, password, email}
router.post("/register", async (req, res) => {
    await authUtil.register(req, res);
    networkUtil.onRouteResponse(res);
});

// req.body = {email}
router.post("/vemail", async (req, res) => {
    await emailUtil.startEmailVerification(req, res);
    networkUtil.onRouteResponse(res);
});

// req.body = {userName, password}
router.post("/login", async (req, res) => {
    await authUtil.login(req, res);
    networkUtil.onRouteResponse(res);
});

router.delete("/logout", (req, res) => {
    authUtil.clearToken(res);
    networkUtil.onRouteResponse(res);
});

module.exports = router;