import { randomUUID } from "crypto";
import { Request, Response } from "express";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import CookieUtil from "../../networking/util/cookieUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import { COLLECTION_DEV_RUNTIME } from "../serverConstants";

// Identifies a single DevRunner runtime, used (dev mode only) to invalidate browser cookies left
// behind by a *previous* DevRunner process so a fresh run starts from a clean slate.
//
// The id is stored in the emulated DB, so its lifetime is deliberately tied to the DB's:
//   - Full restart (e.g. `npm stop` + `npm run dev`) resets the Firestore emulator → the marker is
//     gone, so a fresh id is minted, and any cookie stamped with the old id is invalidated.
//   - Hot reload (a file-change-triggered restart) leaves the emulator running → the marker
//     persists, so the same id is reused and existing cookies stay valid.
//
// Anchoring to the DB means we react to the exact condition that matters — "was the DB reset" —
// without needing to know how the process was restarted. This util is inert outside dev mode.

const DEV_RUNTIME_DOC_ID = "singleton";

let bootId = "";

const DevRuntimeUtil =
{
    // Loads (hot reload) or mints (full restart) this runtime's boot id. Must be awaited once at
    // startup, before the server begins handling requests, so the id is ready for every request.
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

    // When a request's cookies were stamped by a previous runtime (or have no stamp yet), drop the
    // auth-related cookies so the request is handled as a brand-new browser, then stamp the current
    // runtime's boot id so the rest of this runtime's requests are recognized as current. Mutates
    // req.cookies and queues the relevant Set-Cookie headers on res.
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
