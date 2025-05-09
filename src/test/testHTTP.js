const http = require("http");
const debugUtil = require("../server/util/debugUtil.js");
const authUtil = require("../server/util/authUtil.js");
const objUtil = require("../shared/util/objUtil.mjs").objUtil;
require("dotenv").config();

let tokenByUserName = {};

const printErrorAndReject = (reject, eventTitle, eventDescObj = undefined) => {
    debugUtil.log(eventTitle, eventDescObj, "high", "pink");

    let eventDesc = "";
    if (eventDescObj != undefined)
        eventDesc = " :: " + JSON.stringify(eventDescObj);
    reject(`[${eventTitle}]${eventDesc}`);
};

const cacheTokenFromRes = (req, res) => {
    const setCookie = res.headers["set-cookie"];
    if (setCookie)
    {
        let tokenFound = false;
        for (const kvp of setCookie.join(";").split(";").map(x => x.trim().split("=")))
        {
            if (kvp[0] == "thingspool_token")
            {
                const token = kvp[1];
                const userName = authUtil.getUserFromToken(token).userName;
                tokenByUserName[userName] = token;
                const tokenAbbreviated = token.substring(0, 20);
                debugUtil.log(`Token Cached (${userName})`, {token: (tokenAbbreviated.length < token.length) ? (tokenAbbreviated + "...") : token}, "low");
                tokenFound = true;
            }
        }
        if (!tokenFound)
            debugUtil.log(`Token Cache Failed`, {setCookie}, "high", "pink");
    }
};

const testHTTP =
{
    _reset: () =>
    {
        tokenByUserName = {};
    },
    makeRequest: (senderUserName, method, path, body, receiveCookie = true) => new Promise((resolve, reject) =>
    {
        const headers = { "Content-Type": "application/json" };
        if (senderUserName)
        {
            const token = tokenByUserName[senderUserName];
            if (token)
                headers["Cookie"] = `thingspool_token=${token};`;
            else
                return printErrorAndReject(reject, `Token Not Found (${path})`, {senderUserName});
        }
    
        const options = { host: "localhost", port: process.env.PORT, path, method, headers };

        const req = http.request(options, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300)
                return printErrorAndReject(reject, `Res Callback ERROR (${path})`, {statusCode: res.statusCode});
            debugUtil.log(`Res Callback (${path})`, {statusCode: res.statusCode}, "low");
            let data = "";
            res.setEncoding("utf8");

            res.on("data", (chunk) => {
                if (res.statusCode < 200 || res.statusCode >= 300)
                    return printErrorAndReject(reject, `Res Data ERROR (${path})`, {statusCode: res.statusCode, chunk});
                debugUtil.log(`Res Data (${path})`, {statusCode: res.statusCode, chunk}, "low");
                data += chunk;
            });
            res.on("end", () => {
                if (res.statusCode < 200 || res.statusCode >= 300)
                    return printErrorAndReject(reject, `Res End ERROR (${path})`, {statusCode: res.statusCode, data}, "high");
                debugUtil.log(`Res End (${path})`, {statusCode: res.statusCode, data}, "low");
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
        debugUtil.log(`Req Sent (${path})`, {options: objUtil.limitPropValueTextSize(options, "Cookie", 40), body}, "high");
    }),
    resOk: (requestCallResult) =>
    {
        const res = requestCallResult.res;
        return (res.statusCode >= 200 && res.statusCode < 300);
    },
}

module.exports = testHTTP;