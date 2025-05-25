import authUtil from "../util/authUtil";
import emailUtil from "../util/emailUtil";
import networkUtil from "../util/networkUtil";
import express from "express";
import { Request, Response } from "express";

const router = express.Router();

// req.body = {userName, password, email, verificationCode}
router.post("/register", async (req: Request, res: Response): Promise<void> => {
    await authUtil.register(req, res);
    networkUtil.onRouteResponse(res);
});

// req.body = {email}
router.post("/vemail", async (req: Request, res: Response): Promise<void> => {
    await emailUtil.startEmailVerification(req, res);
    networkUtil.onRouteResponse(res);
});

// req.body = {userName, password}
router.post("/login", async (req: Request, res: Response): Promise<void> => {
    await authUtil.login(req, res);
    networkUtil.onRouteResponse(res);
});

router.delete("/logout", (req: Request, res: Response): void => {
    authUtil.clearToken(res);
    networkUtil.onRouteResponse(res);
});

export default router;