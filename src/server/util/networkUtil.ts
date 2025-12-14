const os = require("os");
import { Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const NetworkUtil =
{
    onRouteResponse: (res: Response, resJSON: {[key: string]: any} | undefined = undefined): void => {
        if (res.statusCode >= 200 && res.statusCode <= 299)
        {
            // End response if its status is OK
            if (resJSON)
                res.json(resJSON);
            else
                res.end();
        }
    },
    getErrorPageURL: (errorPageName: string) => {
        return `${process.env.MODE == "dev" ? `http://${NetworkUtil.getLocalIpAddress()}:${process.env.PORT}` : process.env.URL_STATIC}/error/${errorPageName}.html`;
    },
    getLocalIpAddress: () =>
    {
        if (process.env.MODE != "dev")
            throw new Error("Calling 'getLocalIpAddress' is not allowed in a non-dev mode.");

        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces))
        {
            for (const i of interfaces[name])
            {
                if (i.family == "IPv4" && !i.internal)
                    return i.address;
            }
        }
        return "127.0.0.1";
    }
}

export default NetworkUtil;