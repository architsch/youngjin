import { HOUR_IN_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const WINDOW_MS = HOUR_IN_MS; // 1-hour window
const MAX_GUESTS_PER_IP = 10; // Max guest accounts per IP per window
const MAX_GUESTS_PER_UA = 3; // Max guest accounts per User-Agent per window
const CLEANUP_INTERVAL_MS = 10 * MINUTE_IN_MS; // Clean up stale entries every 10 minutes

type RateLimitRecord = {count: number, windowStart: number};

const guestCreationRecordByIP: {[ip: string]: RateLimitRecord} = {};
const guestCreationRecordByUA: {[ua: string]: RateLimitRecord} = {};
const removePending: string[] = [];

let lastCleanup = Date.now();

const GuestCreationLimitUtil =
{
    // Checks whether the given IP + User-Agent combo is allowed to create a new guest account.
    // Returns true if allowed, or false if either limit has been reached.
    allowGuestCreation(ip: string, userAgent: string): boolean
    {
        const now = Date.now();
        cleanupIfNeeded(now);

        if (!checkAndIncrement(guestCreationRecordByIP, ip, MAX_GUESTS_PER_IP, now))
        {
            LogUtil.log("Guest creation blocked (IP limit)", { ip }, "high", "warn");
            return false;
        }

        if (!checkAndIncrement(guestCreationRecordByUA, userAgent, MAX_GUESTS_PER_UA, now))
        {
            LogUtil.log("Guest creation blocked (User-Agent limit)", { userAgent }, "high", "warn");
            return false;
        }

        return true;
    },
}

function cleanupIfNeeded(now: number): void
{
    if (now - lastCleanup < CLEANUP_INTERVAL_MS)
        return;

    lastCleanup = now;
    purgeExpired(guestCreationRecordByIP, now);
    purgeExpired(guestCreationRecordByUA, now);
}

function purgeExpired(records: {[key: string]: RateLimitRecord}, now: number): void
{
    removePending.length = 0;
    for (const [key, record] of Object.entries(records))
    {
        if (now - record.windowStart >= WINDOW_MS)
            removePending.push(key);
    }
    for (const key of removePending)
        delete records[key];
}

function checkAndIncrement(
    records: {[key: string]: RateLimitRecord}, key: string, max: number, now: number
): boolean
{
    const record = records[key];

    if (!record || now - record.windowStart >= WINDOW_MS)
    {
        records[key] = { count: 1, windowStart: now };
        return true;
    }

    if (record.count >= max)
        return false;

    record.count++;
    return true;
}

export default GuestCreationLimitUtil;
