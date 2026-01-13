import AuthUtil from "../../util/authUtil";
import NetworkUtil from "../../util/networkUtil";
import express from "express";
import { Request, Response } from "express";

const AuthRouter = express.Router();

// req.body = {userName, password}
AuthRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
    await AuthUtil.register(req, res);
    NetworkUtil.onRouteResponse(res);
});

// req.body = {userName, password}
AuthRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
    await AuthUtil.login(req, res);
    NetworkUtil.onRouteResponse(res);
});

AuthRouter.get("/logout", (req: Request, res: Response): void => {
    AuthUtil.clearToken(req, res);
    NetworkUtil.onRouteResponse(res);
});

export default AuthRouter;