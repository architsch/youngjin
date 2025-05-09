const consoleIO = require("../socket/consoleIO");

const debugUtil =
{
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: (logLevelOrName) =>
    {
        debugUtil.thresholdLogLevel = isNaN(logLevelOrName) ?
            debugUtil.getLogLevelFromName(logLevelOrName) : logLevelOrName;
    },
    getThresholdLogLevel: () =>
    {
        return debugUtil.thresholdLogLevel;
    },
    getLogLevelFromName: (logLevelName) => // "low" for 0, "medium" for 1, "high" for 2
    {
        switch (logLevelName)
        {
            case "low": return 0;
            case "medium": return 1;
            case "high": return 2;
            default: console.error(`ERROR: Unknown log level name ("${logLevelName}")`);
        }
        return 0;
    },
    log: (eventTitle, eventDescObj = undefined, logLevelName = "high", highlightColor = undefined) =>
    {
        let details = "";
        if (eventDescObj != undefined)
            details = JSON.stringify(eventDescObj);
        const origin = debugUtil.getFuncCallPath(5, 2);

        const logLevel = debugUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= debugUtil.thresholdLogLevel)
            consoleIO.log((highlightColor ? `<b style="color:${highlightColor}">` : "") + eventTitle + (highlightColor ? "</b>" : ""), origin, details);
    },
    logRaw: (message, logLevelName = "high", highlightColor = undefined) =>
    {
        debugUtil.log(message, undefined, logLevelName, highlightColor);
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