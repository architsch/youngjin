import globalConfig from "../../config/globalConfig";
import debugUtil from "../../util/debugUtil";
import testDB from "../testDB";
import testHTTP from "../testHTTP";

const routePath = "/api/auth/";

const startEmailVerification = async (email: string): Promise<string> => {
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
    initUser: async (user: testUser): Promise<void> => {
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

export default testActions_auth;