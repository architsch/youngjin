import LogUtil from "../../../shared/system/util/logUtil";

const WINDOW_MS = 60 * 1000; // 1-minute rolling window
const WARN_THRESHOLD = 500;  // Log warning at this many queries/min
const CRITICAL_THRESHOLD = 1000; // Reject non-essential queries at this many queries/min

let queryCount = 0;
let windowStart = Date.now();

const DBQueryRateMonitor =
{
    /**
     * Records a query and checks if the rate is within acceptable limits.
     * Returns true if the query should proceed, false if it should be rejected.
     */
    allowQuery(queryType: string): boolean
    {
        const now = Date.now();

        // Reset window if expired
        if (now - windowStart >= WINDOW_MS)
        {
            queryCount = 0;
            windowStart = now;
        }

        queryCount++;

        if (queryCount > CRITICAL_THRESHOLD)
        {
            // Allow select queries (reads) since they're cheaper, block writes
            if (queryType !== "select")
            {
                LogUtil.log("DB query rate CRITICAL — write query rejected",
                    { queryCount, queryType }, "high", "error");
                return false;
            }
        }

        if (queryCount === WARN_THRESHOLD)
        {
            LogUtil.log("DB query rate WARNING — approaching limit",
                { queryCount }, "high", "warn");
        }

        return true;
    },
};

export default DBQueryRateMonitor;
