const http = require("http");
require("dotenv").config();

let tokenByUserName = {};

const cacheTokenFromRes = (userName, res) => {
    const setCookie = res.headers["Set-Cookie"];
    if (setCookie)
    {
        for (const kvp of setCookie.split(";").map(x => x.trim().split("=")))
        {
            if (kvp[0] == "thingspool_token")
            {
                tokenByUserName[userName] = kvp[1];
                console.log(`Token (${userName}) :: ${tokenByUserName[userName]}`);
            }
            else
                console.error("Token not found.");
        }
    }
    else
        console.error("Cookie not found.");
};

const post = (path, body, token = undefined) => new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (token)
        headers["Cookie"] = `thingspool_token=${token};`;

    const options = { host: "localhost", port: process.env.PORT, path, method: "POST", headers };
    console.log(`testServerCall START ::\noptions = ${JSON.stringify(options, null, 4)}`);

    const req = http.request(options, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
            console.log(`testServerCall END ::\nstatusCode = ${res.statusCode}\ndata = ${data}`);
            resolve({res, data});
        });
        res.on("error", (err) => reject(err));
    });
    req.write(JSON.stringify(body));
    req.end();
});

const testServerCalls =
{
    _reset: () =>
    {
        tokenByUserName = {};
    },
    register: async (userName, password, email, verificationCode) =>
    {
        const callResult = await post("/api/register", {userName, password, email, verificationCode});
        cacheTokenFromRes(userName, callResult.res);
        return callResult;
    },
    vemail: async (email) =>
    {
        const callResult = await post("/api/vemail", {email});
        return callResult;
    },
    login: async (userName, password) =>
    {
        const callResult = await post("/api/login", {userName, password});
        cacheTokenFromRes(userName, callResult.res);
        return callResult;
    },
}

module.exports = testServerCalls;