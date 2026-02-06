import express from "express";
import { Request, Response } from "express";
import UserAuthPasswordUtil from "../../../user/util/userAuthPasswordUtil";
import UserAuthGoogleUtil from "../../../user/util/userAuthGoogleUtil";
import UserTokenUtil from "../../../user/util/userTokenUtil";
import AddressUtil from "../../util/addressUtil";

const UserRouter = express.Router();
/*
// req.body = {userName, password}
UserRouter.post("/register_password", async (req: Request, res: Response): Promise<void> => {
    await UserAuthPasswordUtil.register(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

// req.body = {userName, password}
UserRouter.post("/login_password", async (req: Request, res: Response): Promise<void> => {
    await UserAuthPasswordUtil.login(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});
*/
UserRouter.get("/login_google", async (req: Request, res: Response): Promise<void> => {
    await UserAuthGoogleUtil.login(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

UserRouter.get("/login_google_callback", async (req: Request, res: Response): Promise<void> => {
    await UserAuthGoogleUtil.loginCallback(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.redirect(AddressUtil.getMyPageURL());
});

UserRouter.get("/logout", (req: Request, res: Response): void => {
    UserTokenUtil.clearTokenFromUser(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

export default UserRouter;