import { Response } from "express";

const networkUtil =
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
}

export default networkUtil;