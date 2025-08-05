import http from "http";
import DebugUtil from "../Util/DebugUtil";
import AuthUtil from "../Util/AuthUtil";
import ObjUtil from "../../Shared/Util/ObjUtil";
import dotenv from "dotenv";
dotenv.config();

let tokenByUserName: {[userName: string]: string} = {};

const printErrorAndReject = (reject: (reason?: any) => void,
    eventTitle: string, eventDescObj: any = undefined): void =>
{
    DebugUtil.log(eventTitle, eventDescObj, "high", "pink");

    let eventDesc = "";
    if (eventDescObj != undefined)
        eventDesc = " :: " + JSON.stringify(eventDescObj);
    reject(`[${eventTitle}]${eventDesc}`);
};

const cacheTokenFromRes = (req: http.ClientRequest, res: http.IncomingMessage) => {
    const setCookie = res.headers["set-cookie"];
    if (setCookie)
    {
        let tokenFound = false;
        for (const kvp of setCookie.join(";").split(";").map(x => x.trim().split("=")))
        {
            if (kvp[0] == "thingspool_token")
            {
                const token = kvp[1];
                const user = AuthUtil.getUserFromToken(token);
                if (!user)
                    return;
                const userName = user.userName;
                tokenByUserName[userName] = token;
                const tokenAbbreviated = token.substring(0, 20);
                DebugUtil.log(`Token Cached (${userName})`, {token: (tokenAbbreviated.length < token.length) ? (tokenAbbreviated + "...") : token}, "low");
                tokenFound = true;
            }
        }
        if (!tokenFound)
            DebugUtil.log(`Token Cache Failed`, {setCookie}, "high", "pink");
    }
};

const TestHTTP =
{
    _reset: () =>
    {
        tokenByUserName = {};
    },
    makeRequest: (senderUserName: string | null, method: string, path: string,
        body: {[key: string]: any}, receiveCookie: boolean = true)
        : Promise<{res: http.IncomingMessage, data: string}> => new Promise((resolve, reject) =>
    {
        const headers: {[headerName: string]: any} = {
            "Content-Type": "application/json"
        };
        if (senderUserName)
        {
            const token = tokenByUserName[senderUserName];
            if (token)
                headers["Cookie"] = `thingspool_token=${token};`;
            else
            {
                printErrorAndReject(reject, `Token Not Found (${path})`, {senderUserName});
                return;
            }
        }
    
        const options: http.RequestOptions = {
            host: "localhost", port: process.env.PORT, path, method, headers
        };

        const req: http.ClientRequest = http.request(options, (res: http.IncomingMessage) => {
            if (!TestHTTP.resOk(res))
            {
                printErrorAndReject(reject, `Res Callback ERROR (${path})`, {statusCode: res.statusCode});
                return;
            }
            DebugUtil.log(`Res Callback (${path})`, {statusCode: res.statusCode}, "low");
            let data = "";
            res.setEncoding("utf8");

            res.on("data", (chunk) => {
                if (!TestHTTP.resOk(res))
                {
                    printErrorAndReject(reject, `Res Data ERROR (${path})`, {statusCode: res.statusCode, chunk});
                    return;
                }
                DebugUtil.log(`Res Data (${path})`, {statusCode: res.statusCode, chunk}, "low");
                data += chunk;
            });
            res.on("end", () => {
                if (!TestHTTP.resOk(res))
                {
                    printErrorAndReject(reject, `Res End ERROR (${path})`, {statusCode: res.statusCode, data});
                    return;
                }
                DebugUtil.log(`Res End (${path})`, {statusCode: res.statusCode, data}, "low");
                if (receiveCookie)
                    cacheTokenFromRes(req, res);
                resolve({res, data});
            });
            res.on("error", (err) => printErrorAndReject(reject, `Res Exception (${path})`, {err}));
        });
        req.on("error", (err) => printErrorAndReject(reject, `Req Exception (${path})`, {err}));

        if (body)
            req.write(JSON.stringify(body));
        req.end();
        DebugUtil.log(`Req Sent (${path})`, {options: ObjUtil.limitPropValueTextSize(options, "Cookie", 40), body}, "high");
    }),
    resOk: (res: http.IncomingMessage) =>
    {
        if (res.statusCode)
            return res.statusCode >= 200 && res.statusCode < 300;
        DebugUtil.log(`Res statusCode is undefined.`, {}, "high", "pink");
        return false;
    },
}

export default TestHTTP;