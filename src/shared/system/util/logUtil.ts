import { logEventObservable } from "../sharedObservables";

const LogUtil =
{
    thresholdLogLevel: 0, // 0 = low importance, 1 = medium importance, 2 = high importance
    setThresholdLogLevel: (logLevelOrName: number | string): void =>
    {
        LogUtil.thresholdLogLevel = isNaN(logLevelOrName as number) ?
            LogUtil.getLogLevelFromName(logLevelOrName as string) : (logLevelOrName as number);
    },
    getThresholdLogLevel: (): number =>
    {
        return LogUtil.thresholdLogLevel;
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
    log: (eventTitle: string, eventDescObj: any = undefined,
        logLevelName: string = "high", logType: "info" | "warn" | "error" = "info"): void =>
    {
        let eventDescJSON = "";
        if (eventDescObj != undefined)
            eventDescJSON = JSON.stringify(eventDescObj).substring(0, 1024);

        const logLevel = LogUtil.getLogLevelFromName(logLevelName);
        if (logLevel >= LogUtil.thresholdLogLevel)
        {
            logEventObservable.set({eventTitle, eventDescJSON, logLevel, logType});

            const logStr = `${eventTitle} :: ${eventDescJSON}`;
            switch (logType)
            {
                case "info": console.log(logStr); break;
                case "warn": console.warn(logStr); break;
                case "error": console.trace(logStr); break;
                default: throw new Error(`Unknown log type: ${logType}`);
            }
        }
    },
    logRaw: (eventTitle: string, logLevelName: string = "medium", logType: "info" | "warn" | "error" = "info"): void =>
    {
        LogUtil.log(eventTitle, undefined, logLevelName, logType);
    },
}

export default LogUtil;