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
    // Browser-scoped flag: this browser finished/skipped the tutorial, so new accounts on it skip it.
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
    // Dev-only runtime boot id (see DevRuntimeUtil).
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
    // clearCookie warns about maxAge/expires, so strip them while keeping matching attributes.
    toClearOptions: ({ maxAge, expires, ...rest }: CookieOptions): CookieOptions =>
    {
        return rest;
    },
}

export default CookieUtil;