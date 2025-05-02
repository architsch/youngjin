const consoleIO = require("../socket/consoleIO");

const debugUtil =
{
    log: (eventTitle, eventDescObj = undefined) =>
    {
        let details = "";
        if (eventDescObj != undefined)
            details = JSON.stringify(eventDescObj);
        const origin = debugUtil.getFuncCallPath(5, 2);
        consoleIO.log(eventTitle, origin, details);
    },
    logRaw: (message) =>
    {
        consoleIO.log(message, "", "");
    },
    getFuncCallPath: (pathLengthLimit = 1, numClosestFuncCallsToSkip = 1) =>
    {
        const stackTrace = {};
        Error.captureStackTrace(stackTrace);
        const stack = stackTrace.stack;

        const callingFunctionNames = stack
            .match(/((at Object\.)|(at async Object\.))[\w]+\s/g)
            .map(x => x.replace(/(at Object\.)|(at async Object\.)/g, "").trim());
        
        for (let i = 0; i < numClosestFuncCallsToSkip; ++i)
            callingFunctionNames.shift();
        while (callingFunctionNames.length > pathLengthLimit)
            callingFunctionNames.pop();
        return callingFunctionNames.join(" <- ");
    }
}

module.exports = debugUtil;