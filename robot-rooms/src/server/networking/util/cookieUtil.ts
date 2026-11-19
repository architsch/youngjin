import { CookieOptions } from "express";
import { AUTH_TOKEN_NAME_BASE, DEV_BOOT_ID_COOKIE_NAME, OAUTH_RETURN_ROOM_COOKIE_NAME_BASE, OAUTH_STATE_COOKIE_NAME_BASE,
    TUTORIAL_FINISHED_COOKIE_NAME_BASE } from "../../system/serverConstants";
import { MINUTE_IN_MS, USER_API_ROUTE_PATH } from "../../../shared/system/sharedConstants";

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
    // A sign-in's state, from its start to its callback (see UserSignInUtil).
    getOAuthStateCookieName: () =>
    {
        return `${OAUTH_STATE_COOKIE_NAME_BASE}${dev ? "_dev" : ""}`;
    },
    // The room a sign-in was started from, which its callback returns the person to; kept as the state is.
    getOAuthReturnRoomCookieName: () =>
    {
        return `${OAUTH_RETURN_ROOM_COOKIE_NAME_BASE}${dev ? "_dev" : ""}`;
    },
    getOAuthStateCookieOptions: (): CookieOptions =>
    {
        return {
            secure: dev ? false : true,
            httpOnly: true,
            sameSite: "lax", // "strict" would be withheld on the way back from the provider
            path: `/${USER_API_ROUTE_PATH}`,
            maxAge: 10 * MINUTE_IN_MS,
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