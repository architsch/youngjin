import { Request, Response } from "express";
import { randomUUID } from "crypto";
import DBUserUtil from "../../db/util/dbUserUtil";
import UserTokenUtil from "./userTokenUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import LogUtil from "../../../shared/system/util/logUtil";
import OwnedRoomUtil from "../../room/util/ownedRoomUtil";

// Dev-only fake OAuth sign-in: promotes the current guest with a unique fake email (the "new account"
// path), without contacting a provider. Called only when MODE == "dev".

const DevOAuthUtil =
{
    fakeSignIn: async (req: Request, res: Response): Promise<void> =>
    {
        const unique = randomUUID().slice(0, 8);
        const userName = `DevOAuth-${unique}`;
        const email = `${userName.toLowerCase()}@dev.local`;

        // Like the real callback, a signed-in member is not treated as a guest (a second account is made).
        const currentToken = req.cookies[CookieUtil.getAuthTokenName()];
        const currentUserID = currentToken ? UserTokenUtil.getUserIdFromToken(currentToken) : undefined;
        const currentUser = currentUserID ? await DBUserUtil.findUserById(currentUserID) : null;
        const guestId = currentUser?.userType == UserTypeEnumMap.Guest ? currentUserID : undefined;

        let memberUserID = "";
        if (guestId)
        {
            // In-place promotion; the JWT still points at the same document.
            await DBUserUtil.upgradeGuestToMember(guestId, userName, email);
            LogUtil.logRaw(`[DevOAuth] Promoted guest ${guestId} to Member "${userName}" (${email})`, "low", "info");
            memberUserID = guestId;
        }
        else
        {
            // No guest to upgrade (e.g. cookies were cleared) — mint a fresh Member and issue a token.
            const result = await DBUserUtil.createUser(userName, UserTypeEnumMap.Member, email);
            if (result.success && result.data.length > 0)
            {
                UserTokenUtil.addTokenForUserId(result.data[0].id, req, res);
                LogUtil.logRaw(`[DevOAuth] Created Member "${userName}" (${email})`, "low", "info");
                memberUserID = result.data[0].id;
            }
            else
            {
                LogUtil.logRaw(`[DevOAuth] Failed to create Member "${userName}"`, "high", "error");
            }
        }

        // New members get their room and are redirected into it, as in the real callback.
        const ownedRoomID = memberUserID.length > 0
            ? await OwnedRoomUtil.setUpFirstOwnedRoom(memberUserID)
            : "";

        res.redirect(ownedRoomID.length > 0 ? `/${ownedRoomID}` : "/");
    },
}

export default DevOAuthUtil;
