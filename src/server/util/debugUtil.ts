import consoleIO from "../sockets/consoleIO";

const debugUtil =
{
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: (logLevelOrName: number | string): void =>
    {
        debugUtil.thresholdLogLevel = isNaN(logLevelOrName as number) ?
            debugUtil.getLogLevelFromName(logLevelOrName as string) : (logLevelOrName as number);
    },
    getThresholdLogLevel: (): number =>
    {
        return debugUtil.thresholdLogLevel;
    },
    getLogLevelFromName: (logLevelName: string): number => // "low" for 0, "medium" for 1, "high" for 2
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
    log: (eventTitle: string, eventDescObj: any = undefined, logLevelName: string = "high", highlightColor?: string): void =>
    {
        let details = "";
        if (eventDescObj != undefined)
            details = JSON.stringify(eventDescObj);
        const origin = debugUtil.getFuncCallPath(5, 2);

        const logLevel = debugUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= debugUtil.thresholdLogLevel)
            consoleIO.log((highlightColor ? `<b style="color:${highlightColor}">` : "") + eventTitle + (highlightColor ? "</b>" : ""), origin, details);
    },
    logRaw: (message: string, logLevelName: string = "high", highlightColor?: string): void =>
    {
        debugUtil.log(message, undefined, logLevelName, highlightColor);
    },
    getFuncCallPath: (pathLengthLimit: number = 1, numClosestFuncCallsToSkip: number = 1): string =>
    {
        const stackTrace: any = {};
        Error.captureStackTrace(stackTrace);
        const stack = stackTrace.stack;

        const callingFunctionNames = stack
            .match(/((at Object\.)|(at async Object\.))[\w]+\s/g)
            .map((x: any) => x.replace(/(at Object\.)|(at async Object\.)/g, "").trim());
        
        for (let i = 0; i < numClosestFuncCallsToSkip; ++i)
            callingFunctionNames.shift();
        while (callingFunctionNames.length > pathLengthLimit)
            callingFunctionNames.pop();
        return callingFunctionNames.join(" <- ");
    }
}

export default debugUtil;