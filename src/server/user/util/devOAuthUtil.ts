import { Request, Response } from "express";
import { randomUUID } from "crypto";
import DBUserUtil from "../../db/util/dbUserUtil";
import UserTokenUtil from "./userTokenUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import LogUtil from "../../../shared/system/util/logUtil";

// Dev mode only. Imitates a successful OAuth provider (e.g. Google) sign-in without contacting any
// external provider, so the guest→Member promotion can be exercised end-to-end on a local machine.
//
// The real flow redirects the browser to the provider, then a callback exchanges the returned code
// for the user's email and promotes the current guest. Here we skip every network round-trip and
// synthesize a *unique* fake email instead, which keeps us on the "brand-new account" path so each
// click reliably promotes the clicking browser's guest in-place — exactly what the real callback
// does for a first-time sign-in. Its only caller is gated on MODE == "dev".

const DevOAuthUtil =
{
    fakeSignIn: async (req: Request, res: Response): Promise<void> =>
    {
        const unique = randomUUID().slice(0, 8);
        const userName = `DevOAuth-${unique}`;
        const email = `${userName.toLowerCase()}@dev.local`;

        // Resolve the current guest from the JWT cookie, mirroring the real callback.
        const currentToken = req.cookies[CookieUtil.getAuthTokenName()];
        const guestId = currentToken ? UserTokenUtil.getUserIdFromToken(currentToken) : undefined;

        if (guestId)
        {
            // Promote the guest document in-place (preserves gameplay state); the JWT keeps pointing
            // at the same document id, so no new token is needed.
            await DBUserUtil.upgradeGuestToMember(guestId, userName, email);
            LogUtil.logRaw(`[DevOAuth] Promoted guest ${guestId} to Member "${userName}" (${email})`, "low", "info");
        }
        else
        {
            // No guest to upgrade (e.g. cookies were cleared) — mint a fresh Member and issue a token.
            const result = await DBUserUtil.createUser(userName, UserTypeEnumMap.Member, email);
            if (result.success && result.data.length > 0)
            {
                UserTokenUtil.addTokenForUserId(result.data[0].id, req, res);
                LogUtil.logRaw(`[DevOAuth] Created Member "${userName}" (${email})`, "low", "info");
            }
            else
            {
                LogUtil.logRaw(`[DevOAuth] Failed to create Member "${userName}"`, "high", "error");
            }
        }

        res.redirect("/");
    },
}

export default DevOAuthUtil;
