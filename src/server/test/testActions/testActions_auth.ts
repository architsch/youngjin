import GlobalConfig from "../../../shared/config/globalConfig";
import DebugUtil from "../../util/debugUtil";
import TestDB from "../testDB";
import TestHTTP from "../testHTTP";

const routePath = "/api/auth/";

const startEmailVerification = async (email: string): Promise<string> => {
    const vemailResult = await TestHTTP.makeRequest(null, "POST", `${routePath}vemail`, {email}, false);
    const verificationCode = vemailResult.data;
    TestDB.insertEmailVerification({
        email,
        verificationCode,
        expirationTime: Math.floor(Date.now() * 0.001) + GlobalConfig.auth.emailVerificationTimeoutInSeconds,
    });
    return verificationCode;
};

const TestActions_Auth =
{
    initUser: async (user: TestUser): Promise<void> => {
        if (!TestDB.insertUser(user))
            return;
        DebugUtil.log("testActions_auth.initUser", {userName: user.userName}, "high", "cyan");
        const verificationCode = await startEmailVerification(user.email);
        DebugUtil.logRaw(`Verification Code = ${verificationCode}`, "low");

        await TestHTTP.makeRequest(null, "POST", `${routePath}register`, {
            userName: user.userName,
            password: user.password,
            email: user.email,
            verificationCode: verificationCode,
        });
    },
}

export default TestActions_Auth;