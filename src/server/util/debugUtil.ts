import ConsoleSockets from "../sockets/consoleSockets";

const stackTrace: string[] = [];

const DebugUtil =
{
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: (logLevelOrName: number | string): void =>
    {
        DebugUtil.thresholdLogLevel = isNaN(logLevelOrName as number) ?
            DebugUtil.getLogLevelFromName(logLevelOrName as string) : (logLevelOrName as number);
    },
    getThresholdLogLevel: (): number =>
    {
        return DebugUtil.thresholdLogLevel;
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
        const origin = DebugUtil.getStackTrace();

        const logLevel = DebugUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= DebugUtil.thresholdLogLevel)
            ConsoleSockets.log((highlightColor ? `<b style="color:${highlightColor}">` : "") + eventTitle + (highlightColor ? "</b>" : ""), origin, details);
    },
    logRaw: (message: string, logLevelName: string = "high", highlightColor?: string): void =>
    {
        DebugUtil.log(message, undefined, logLevelName, highlightColor);
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
        DebugUtil.logRaw(`pushStackTrace: ${traceName}`, "high", "gray");
    },
    popStackTrace: (traceName: string): void =>
    {
        if (stackTrace.length == 0)
        {
            DebugUtil.logRaw(`No name to pop in stackTrace :: (traceName = ${traceName})`, "high", "pink");
            return;
        }
        const expectedTraceName = stackTrace.pop();
        if (expectedTraceName != traceName)
        {
            DebugUtil.logRaw(`Name mismatch in stackTrace :: (traceName = ${traceName}, expectedTraceName = ${expectedTraceName})`, "high", "pink");
            return;
        }
        DebugUtil.logRaw(`popStackTrace: ${traceName}`, "high", "gray");
    },
}

export default DebugUtil;