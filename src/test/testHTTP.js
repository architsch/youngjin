const http = require("http");
const debugUtil = require("../server/util/debugUtil.js");
require("dotenv").config();

let tokenByUserName = {};
let currActiveUserName = null;

const printErrorAndReject = (reject, eventTitle, eventDescObj = undefined) => {
    debugUtil.log(eventTitle, eventDescObj);

    let eventDesc = "";
    if (eventDescObj != undefined)
        eventDesc = " :: " + JSON.stringify(eventDescObj);
    reject(`[${eventTitle}]${eventDesc}`);
};

const cacheTokenFromRes = (res) => {
    //console.log("<<< HEADERS >>> ::\n" + JSON.stringify(res.headers));
    const setCookie = res.headers["set-cookie"];
    if (setCookie)
    {
        let tokenFound = false;
        for (const kvp of setCookie.join(";").split(";").map(x => x.trim().split("=")))
        {
            if (kvp[0] == "thingspool_token")
            {
                tokenByUserName[currActiveUserName] = kvp[1];
                //console.log(`Token (${currActiveUserName}) :: ${tokenByUserName[currActiveUserName]}`);
                tokenFound = true;
            }
        }
        if (!tokenFound)
            console.error("Token not found.");
    }
    //else
    //    console.error("Cookie not found.");
};

const testHTTP =
{
    _reset: () =>
    {
        tokenByUserName = {};
        currActiveUserName = null;
    },
    switchUser: (userName) =>
    {
        if (userName)
        {
            if (tokenByUserName[userName] == undefined)
                console.error(`Failed to switch user to "${userName}" because no corresponding token was found.`);
            else
                currActiveUserName = userName;
        }
        else
            currActiveUserName = null;
    },
    get: (path, body = undefined) => testHTTP.makeRequest("GET", path, body),
    post: (path, body = undefined) => testHTTP.makeRequest("POST", path, body),
    put: (path, body = undefined) => testHTTP.makeRequest("PUT", path, body),
    delete: (path, body = undefined) => testHTTP.makeRequest("DELETE", path, body),
    makeRequest: (method, path, body) => new Promise((resolve, reject) =>
    {
        const headers = { "Content-Type": "application/json" };
        if (currActiveUserName)
        {
            const token = tokenByUserName[currActiveUserName];
            if (token)
                headers["Cookie"] = `thingspool_token=${token};`;
            else
                return printErrorAndReject(reject, "Token not found", {path, currActiveUserName});
        }
    
        const options = { host: "localhost", port: process.env.PORT, path, method, headers };
        debugUtil.log("Request Preparation Started", {path, options, body});

        const req = http.request(options, (res) => {
            debugUtil.log("Response", {path});
            if (res.statusCode < 200 || res.statusCode >= 300)
                return printErrorAndReject(reject, "Bad status code", {path, statusCode: res.statusCode});
            let data = "";
            res.setEncoding("utf8");

            res.on("data", (chunk) => {
                if (res.statusCode < 200 || res.statusCode >= 300)
                    return printErrorAndReject(reject, "Response Data Chunk with ERROR", {path, statusCode: res.statusCode, chunk});
                debugUtil.log("Response Data Chunk", {path, chunk});
                data += chunk;
            });
            res.on("end", () => {
                if (res.statusCode < 200 || res.statusCode >= 300)
                    return printErrorAndReject(reject, "Response Ended with ERROR", {path, statusCode: res.statusCode, data});
                debugUtil.log("Response Ended", {path, statusCode: res.statusCode, data});
                cacheTokenFromRes(res);
                resolve({res, data});
            });
            res.on("error", (err) => printErrorAndReject(reject, "Response Object (res) Error", {path, err}));
        });
        req.on("error", (err) => printErrorAndReject(reject, "Request Object (req) Error", {path, err}));

        if (body)
            req.write(JSON.stringify(body));
        req.end();
        debugUtil.log("Request Sent", {path});
    }),
    resOk: (requestCallResult) =>
    {
        const res = requestCallResult.res;
        return (res.statusCode >= 200 && res.statusCode < 300);
    },
}

module.exports = testHTTP;