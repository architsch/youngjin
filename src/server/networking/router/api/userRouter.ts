import express from "express";
import { Request, Response } from "express";
import UserAuthGoogleUtil from "../../../user/util/userAuthGoogleUtil";
import UserTokenUtil from "../../../user/util/userTokenUtil";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import DBUserUtil from "../../../db/util/dbUserUtil";
import CookieUtil from "../../util/cookieUtil";
import User from "../../../../shared/user/types/user";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../shared/system/sharedConstants";

const UserRouter = express.Router();

UserRouter.get("/login_google", async (req: Request, res: Response): Promise<void> => {
    await UserAuthGoogleUtil.login(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

UserRouter.get("/login_google_callback", async (req: Request, res: Response): Promise<void> => {
    await UserAuthGoogleUtil.loginCallback(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.redirect("/");
});

UserRouter.post("/logout", (req: Request, res: Response): void => {
    UserTokenUtil.clearToken(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

// Debug-only convenience for testing the tutorial in live/staging: send a user who has already
// finished the single-player experience back through the tutorial. Only valid when the user is not
// currently in any single-player mode (singlePlayerMode == ""); otherwise it is a no-op rejection.
UserRouter.post("/restart_tutorial", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    // Guard mirrored on the client: restarting only makes sense for a finished single-player user.
    if (user.singlePlayerMode != "")
    {
        res.status(409).send("Cannot restart the tutorial while a single-player mode is in progress.");
        return;
    }

    // identifyAnyUser just (re)set the "tutorial finished" browser cookie because this user's mode is
    // "". Clear it here so a fresh guest later spawned on this browser is not skipped past the tutorial
    // too; this clearCookie is queued after the middleware's set, so the browser ends up clearing it.
    res.clearCookie(CookieUtil.getTutorialFinishedCookieName(), CookieUtil.toClearOptions(CookieUtil.getTutorialFinishedCookieOptions()));

    // Persist the mode flip so the next page load / socket connect routes the user into the tutorial.
    await DBUserUtil.setSinglePlayerMode(user.id, TUTORIAL_SINGLE_PLAYER_MODE);

    res.status(200).send("Tutorial restarted.");
});

export default UserRouter;