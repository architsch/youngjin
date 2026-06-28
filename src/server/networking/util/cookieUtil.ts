import { CookieOptions } from "express";
import { AUTH_TOKEN_NAME_BASE, DEV_BOOT_ID_COOKIE_NAME, TUTORIAL_FINISHED_COOKIE_NAME_BASE } from "../../system/serverConstants";

const dev = process.env.MODE == "dev";

const CookieUtil =
{
    getAuthTokenName: () =>
    {
        return `${AUTH_TOKEN_NAME_BASE}${dev ? "_dev" : ""}`;
    },
    getAuthTokenCookieOptions: (): CookieOptions =>
    {
        return {
            secure: dev ? false : true,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3155692600000, // 100 years
        };
    },
    // A browser-scoped flag remembering that this browser has already finished (or skipped)
    // the single-player tutorial, so freshly created user accounts on it are not forced
    // through the tutorial again (e.g. the new guest spawned after a member signs out).
    getTutorialFinishedCookieName: () =>
    {
        return `${TUTORIAL_FINISHED_COOKIE_NAME_BASE}${dev ? "_dev" : ""}`;
    },
    getTutorialFinishedCookieOptions: (): CookieOptions =>
    {
        return {
            secure: dev ? false : true,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3155692600000, // 100 years
        };
    },
    // A dev-only cookie stamping the browser with the current DevRunner runtime's boot id, so the
    // server can tell whether the browser's auth cookies belong to this runtime (see DevRuntimeUtil).
    getDevBootIdCookieName: () =>
    {
        return DEV_BOOT_ID_COOKIE_NAME;
    },
    getDevBootIdCookieOptions: (): CookieOptions =>
    {
        return {
            secure: false, // dev-only cookie, always served over http
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3155692600000, // 100 years
        };
    },
    // res.clearCookie deprecation-warns on maxAge/expires (it always expires the cookie
    // immediately), so strip them while keeping the attributes (secure/httpOnly/sameSite)
    // needed to match the cookie being cleared.
    toClearOptions: ({ maxAge, expires, ...rest }: CookieOptions): CookieOptions =>
    {
        return rest;
    },
}

export default CookieUtil;