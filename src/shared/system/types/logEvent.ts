export default interface LogEvent
{
    eventTitle: string;
    eventDescJSON: string;
    logLevel: number; // 0 = low importance, 1 = medium importance, 2 = high importance
    logType: "info" | "warn" | "error";
}