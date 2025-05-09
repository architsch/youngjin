const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;
const debugUtil = require("../../server/util/debugUtil");
const testDB = require("../testDB");
const testHTTP = require("../testHTTP");

const routePath = "/api/auth/";

startEmailVerification = async (email) => {
    const vemailResult = await testHTTP.makeRequest(null, "POST", `${routePath}vemail`, {email}, false);
    const verificationCode = vemailResult.data;
    testDB.insertEmailVerification({
        email,
        verificationCode,
        expirationTime: Math.floor(Date.now() * 0.001) + globalConfig.auth.emailVerificationTimeoutInSeconds,
    });
    return verificationCode;
};

const testActions_auth =
{
    initUser: async (user) => {
        if (!testDB.insertUser(user))
            return;
        debugUtil.log("testActions_auth.initUser", {userName: user.userName}, "high", "cyan");
        const verificationCode = await startEmailVerification(user.email);
        debugUtil.logRaw(`Verification Code = ${verificationCode}`, "low");

        await testHTTP.makeRequest(null, "POST", `${routePath}register`, {
            userName: user.userName,
            password: user.password,
            email: user.email,
            verificationCode: verificationCode,
        });
    },
}

module.exports = testActions_auth;