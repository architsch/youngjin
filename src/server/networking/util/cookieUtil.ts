import { CookieOptions } from "express";
import { AUTH_TOKEN_NAME_BASE } from "../../system/serverConstants";

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
}

export default CookieUtil;