import { HOUR_IN_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const WINDOW_MS = HOUR_IN_MS; // 1-hour window
// Guest creation caps: a looser per-IP cap (shared networks) and a tighter per-IP+User-Agent cap (a
// User-Agent alone would be a global key). Dev uses effectively unlimited caps, since E2E creates a
// guest per test from one IP and UA.
const isDev = process.env.MODE == "dev";
const MAX_GUESTS_PER_IP = isDev ? 1_000_000 : 10;     // Max guest accounts per IP per window
const MAX_GUESTS_PER_CLIENT = isDev ? 1_000_000 : 3;  // Max guest accounts per IP + User-Agent per window
const CLEANUP_INTERVAL_MS = 10 * MINUTE_IN_MS; // Clean up stale entries every 10 minutes

type RateLimitRecord = {count: number, windowStart: number};

const guestCreationRecordByIP: {[ip: string]: RateLimitRecord} = {};
const guestCreationRecordByClient: {[ipAndUA: string]: RateLimitRecord} = {};
const removePending: string[] = [];

let lastCleanup = Date.now();

const GuestCreationLimitUtil =
{
    // False if either limit is reached.
    allowGuestCreation(ip: string, userAgent: string): boolean
    {
        const now = Date.now();
        cleanupIfNeeded(now);

        const clientKey = getClientKey(ip, userAgent);

        // Both checked before either is charged.
        if (!isWithinLimit(guestCreationRecordByIP, ip, MAX_GUESTS_PER_IP, now))
        {
            LogUtil.log("Guest creation blocked (IP limit)", { ip }, "high", "warn");
            return false;
        }

        if (!isWithinLimit(guestCreationRecordByClient, clientKey, MAX_GUESTS_PER_CLIENT, now))
        {
            LogUtil.log("Guest creation blocked (client limit)", { ip, userAgent }, "high", "warn");
            return false;
        }

        increment(guestCreationRecordByIP, ip, now);
        increment(guestCreationRecordByClient, clientKey, now);
        return true;
    },
}

// Newlines can't appear in IPs or header values, so they separate the key parts safely.
function getClientKey(ip: string, userAgent: string): string
{
    return `${ip}\n${userAgent}`;
}

function cleanupIfNeeded(now: number): void
{
    if (now - lastCleanup < CLEANUP_INTERVAL_MS)
        return;

    lastCleanup = now;
    purgeExpired(guestCreationRecordByIP, now);
    purgeExpired(guestCreationRecordByClient, now);
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

function isWithinLimit(
    records: {[key: string]: RateLimitRecord}, key: string, max: number, now: number
): boolean
{
    const record = records[key];

    // A missing record, or one whose window has run out, leaves room for a fresh window.
    if (!record || now - record.windowStart >= WINDOW_MS)
        return true;

    return record.count < max;
}

function increment(records: {[key: string]: RateLimitRecord}, key: string, now: number): void
{
    const record = records[key];

    if (!record || now - record.windowStart >= WINDOW_MS)
        records[key] = { count: 1, windowStart: now };
    else
        record.count++;
}

export default GuestCreationLimitUtil;
