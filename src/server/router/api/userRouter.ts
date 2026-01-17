import UserManager from "../../user/userManager";
import express from "express";
import { Request, Response } from "express";

const UserRouter = express.Router();

// req.body = {userName, password}
UserRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
    await UserManager.register(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

// req.body = {userName, password}
UserRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
    await UserManager.login(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

UserRouter.get("/logout", (req: Request, res: Response): void => {
    UserManager.clearToken(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

export default UserRouter;