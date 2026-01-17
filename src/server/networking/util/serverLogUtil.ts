import ConsoleSockets from "../../sockets/consoleSockets";

const stackTrace: string[] = [];

const ServerLogUtil =
{
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: (logLevelOrName: number | string): void =>
    {
        ServerLogUtil.thresholdLogLevel = isNaN(logLevelOrName as number) ?
            ServerLogUtil.getLogLevelFromName(logLevelOrName as string) : (logLevelOrName as number);
    },
    getThresholdLogLevel: (): number =>
    {
        return ServerLogUtil.thresholdLogLevel;
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
            details = JSON.stringify(eventDescObj).substring(0, 1024);
        const origin = ServerLogUtil.getStackTrace();

        const logLevel = ServerLogUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= ServerLogUtil.thresholdLogLevel)
            ConsoleSockets.log((highlightColor ? `<b style="color:${highlightColor}">` : "") + eventTitle + (highlightColor ? "</b>" : ""), origin, details);
    },
    logRaw: (message: string, logLevelName: string = "high", highlightColor?: string): void =>
    {
        ServerLogUtil.log(message, undefined, logLevelName, highlightColor);
    },
    getStackTrace: (): string =>
    {
        const arr: string[] = [];
        for (let i = stackTrace.length-1; i >= 0; --i)
            arr.push(stackTrace[i]);
        return arr.join(" <- ");
    },
    pushStackTrace: (traceName: string): void =>
    {
        stackTrace.push(traceName);
        ServerLogUtil.logRaw(`pushStackTrace: ${traceName}`, "high", "gray");
    },
    popStackTrace: (traceName: string): void =>
    {
        if (stackTrace.length == 0)
        {
            ServerLogUtil.logRaw(`No name to pop in stackTrace :: (traceName = ${traceName})`, "high", "pink");
            return;
        }
        const expectedTraceName = stackTrace.pop();
        if (expectedTraceName != traceName)
        {
            ServerLogUtil.logRaw(`Name mismatch in stackTrace :: (traceName = ${traceName}, expectedTraceName = ${expectedTraceName})`, "high", "pink");
            return;
        }
        ServerLogUtil.logRaw(`popStackTrace: ${traceName}`, "high", "gray");
    },
}

export default ServerLogUtil;