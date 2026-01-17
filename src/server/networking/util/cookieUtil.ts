import dotenv from "dotenv";
import { AUTH_TOKEN_NAME_BASE } from "../../../shared/system/constants";
dotenv.config();

const dev = process.env.MODE == "dev";

const CookieUtil =
{
    getAuthTokenName: () =>
    {
        return `${AUTH_TOKEN_NAME_BASE}${dev ? "_dev" : ""}`;
    },
}

export default CookieUtil;