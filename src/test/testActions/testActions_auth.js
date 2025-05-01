const globalConfig = require("../../shared/config/globalConfig.mjs").globalConfig;
const testDB = require("../testDB");
const testHTTP = require("../testHTTP");

const routePath = "/api/auth/";

const testActions_auth =
{
    initUser: async (user) => {
        testHTTP.switchUser(null);
        
        const verificationCode = await testActions_auth.startEmailVerification(user.email);
        await testHTTP.post(`${routePath}register`, {
            userName: user.userName,
            password: user.password,
            email: user.email,
            verificationCode: verificationCode,
        });

        await testHTTP.post(`${routePath}login`, {
            userName: user.userName,
            password: user.password,
        });
        
        testDB.insertUser(user);
    },
    startEmailVerification: async (email) => {
        const verificationCode = await testHTTP.post(`${routePath}vemail`, {email}).data;
        testDB.insertEmailVerification({
            email,
            verificationCode,
            expirationTime: Math.floor(Date.now() * 0.001) + globalConfig.auth.emailVerificationTimeoutInSeconds,
        });
        return verificationCode;
    },
}

module.exports = testActions_auth;