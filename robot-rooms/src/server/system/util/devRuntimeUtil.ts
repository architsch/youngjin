import { randomUUID } from "crypto";
import { Request, Response } from "express";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import { COLLECTION_DEV_RUNTIME } from "../serverConstants";

// Dev-only DevRunner runtime id, stored in the emulated DB so it resets exactly when the DB does:
// a full restart mints a new id (stale cookies are invalidated); a hot reload keeps it.

const DEV_RUNTIME_DOC_ID = "singleton";

let bootId = "";

const DevRuntimeUtil =
{
    // Loads or mints the boot id. Await once before handling requests.
    init: async (): Promise<void> =>
    {
        const db = await FirebaseUtil.getDB();
        const docRef = db.collection(COLLECTION_DEV_RUNTIME).doc(DEV_RUNTIME_DOC_ID);
        const doc = await docRef.get();
        if (doc.exists && doc.data()?.bootId)
        {
            bootId = doc.data()!.bootId;
            LogUtil.logRaw(`[DevRuntime] Reusing boot id from the persisted emulator DB (hot reload): ${bootId}`, "low", "info");
        }
        else
        {
            bootId = randomUUID();
            await docRef.set({ bootId });
            LogUtil.logRaw(`[DevRuntime] Fresh emulator DB detected — minted a new boot id: ${bootId}`, "low", "info");
        }
    },

    // Drops auth cookies stamped by a previous runtime (or unstamped) and stamps the current id.
    // Mutates req.cookies and queues Set-Cookie headers.
    invalidateStaleCookies: (req: Request, res: Response): void =>
    {
        if (req.cookies[CookieUtil.getDevBootIdCookieName()] === bootId)
            return; // Same runtime (this includes hot reloads) → the browser's cookies are current.

        res.clearCookie(CookieUtil.getAuthTokenName(), CookieUtil.toClearOptions(CookieUtil.getAuthTokenCookieOptions()));
        res.clearCookie(CookieUtil.getTutorialFinishedCookieName(), CookieUtil.toClearOptions(CookieUtil.getTutorialFinishedCookieOptions()));
        delete req.cookies[CookieUtil.getAuthTokenName()];
        delete req.cookies[CookieUtil.getTutorialFinishedCookieName()];

        res.cookie(CookieUtil.getDevBootIdCookieName(), bootId, CookieUtil.getDevBootIdCookieOptions());
    },
}

export default DevRuntimeUtil;
