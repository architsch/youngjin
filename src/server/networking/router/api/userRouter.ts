import express from "express";
import { Request, Response } from "express";
import UserSignInUtil from "../../../user/util/userSignInUtil";
import SignInProviderMap from "../../../user/maps/signInProviderMap";
import UserTokenUtil from "../../../user/util/userTokenUtil";
import UserIdentificationUtil from "../../../user/util/userIdentificationUtil";
import DBUserUtil from "../../../db/util/dbUserUtil";
import CookieUtil from "../../util/cookieUtil";
import User from "../../../../shared/user/types/user";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../shared/system/sharedConstants";

const UserRouter = express.Router();

// A sign-in through each provider, at the paths its OAuth client is registered with (login_google_callback, say).
for (const provider of SignInProviderMap.getAll())
{
    UserRouter.get(`/login_${provider.id}`, async (req: Request, res: Response): Promise<void> => {
        await UserSignInUtil.login(provider, req, res);
        if (res.statusCode >= 200 && res.statusCode <= 299)
            res.end();
    });

    UserRouter.get(`/login_${provider.id}_callback`, async (req: Request, res: Response): Promise<void> => {
        await UserSignInUtil.loginCallback(provider, req, res);
        if (res.statusCode >= 200 && res.statusCode <= 299)
            res.redirect("/");
    });
}

UserRouter.post("/logout", (req: Request, res: Response): void => {
    UserTokenUtil.clearToken(req, res);
    if (res.statusCode >= 200 && res.statusCode <= 299)
        res.end();
});

// Debug: send a user who finished the tutorial back through it. Rejected while in a single-player mode.
UserRouter.post("/restart_tutorial", UserIdentificationUtil.identifyAnyUser, async (req: Request, res: Response): Promise<void> => {
    const user = User.fromString((req as any).userString);

    // Guard mirrored on the client: restarting only makes sense for a finished single-player user.
    if (user.singlePlayerMode != "")
    {
        res.status(409).send("Cannot restart the tutorial while a single-player mode is in progress.");
        return;
    }

    // identifyAnyUser just set the "tutorial finished" cookie; clear it (queued after) so a future
    // guest on this browser isn't skipped past the tutorial.
    res.clearCookie(CookieUtil.getTutorialFinishedCookieName(), CookieUtil.toClearOptions(CookieUtil.getTutorialFinishedCookieOptions()));

    // Persist the mode flip so the next page load / socket connect routes the user into the tutorial.
    await DBUserUtil.setSinglePlayerMode(user.id, TUTORIAL_SINGLE_PLAYER_MODE);

    // Reset the user's FTUE, so that post-tutorial guidance UI will show up again.
    await DBUserUtil.setFTUE(user.id, "");

    res.status(200).send("Tutorial restarted.");
});

export default UserRouter;