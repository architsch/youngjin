const testServerCalls = require("./testServerCalls");

const testSteps =
{
    initUser: async (args) => { // args = {userName, password, email}
        let callResult = await testServerCalls.vemail(args.email);
        if (callResult.res.statusCode < 200 || callResult.res.statusCode >= 300)
            return "failed";

        const verificationCode = callResult.data;
        
        callResult = await testServerCalls.register(args.userName, args.password, args.email, verificationCode);
        if (callResult.res.statusCode < 200 || callResult.res.statusCode >= 300)
            return "failed";

        callResult = await testServerCalls.login(args.userName, args.password);
        if (callResult.res.statusCode < 200 || callResult.res.statusCode >= 300)
            return "failed";

        return "success";
    },
}

module.exports = testSteps;