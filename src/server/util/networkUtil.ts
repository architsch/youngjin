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
        return `${process.env.MODE == "dev" ? `http://localhost:${process.env.PORT}` : process.env.URL_STATIC}/error/${errorPageName}.html`;
    },
}

export default NetworkUtil;