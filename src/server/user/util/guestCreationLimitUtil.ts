import { HOUR_IN_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";

const WINDOW_MS = HOUR_IN_MS; // 1-hour window
// Abuse protection for production. Both caps are scoped to the requesting client: the
// per-IP cap bounds a whole network, which an office or campus legitimately shares, while
// the tighter per-client cap bounds one browser identity within that network. The latter
// is keyed on IP *and* User-Agent together — a User-Agent string on its own is shared by
// every browser of that version worldwide, so keying on it alone would make the cap global
// and let unrelated visitors exhaust it for everyone.
// In dev mode the entire dev/test workload originates from a single IP + User-Agent and
// legitimately creates many guests — the E2E suite spins up a fresh browser context (and
// thus a fresh guest) per test — so the production caps would block it and surface as
// 401 "Failed to identify the user". Dev uses effectively-unlimited caps.
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
    // Checks whether the given IP + User-Agent combo is allowed to create a new guest account.
    // Returns true if allowed, or false if either limit has been reached.
    allowGuestCreation(ip: string, userAgent: string): boolean
    {
        const now = Date.now();
        cleanupIfNeeded(now);

        const clientKey = getClientKey(ip, userAgent);

        // Both limits are tested before either is incremented, so a request turned away by
        // one limit does not spend budget against the other.
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

// A newline can appear in neither an IP nor an HTTP header value, so joining on one keeps
// distinct (IP, User-Agent) pairs from colliding into a single record.
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
