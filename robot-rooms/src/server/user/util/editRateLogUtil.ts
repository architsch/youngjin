import LogUtil from "../../../shared/system/util/logUtil";
import User from "../../../shared/user/types/user";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

// How fast each user edits and speaks, logged once per connection, so edit budgets can be set from real use.
// Attempts are counted, refused ones included.

const SHORT_WINDOW_MS = 10 * 1000;

type RateWindow = {startedAt: number, count: number, max: number};
type EditRates = {total: number, firstAt: number, lastAt: number, short: RateWindow, long: RateWindow};

const ratesByUserID: {[userID: string]: {[kind: string]: EditRates}} = {};

const EditRateLogUtil =
{
    note: (userID: string, kind: "edit" | "speech"): void =>
    {
        const now = Date.now();
        const ratesByKind = ratesByUserID[userID] ?? (ratesByUserID[userID] = {});
        const rates = ratesByKind[kind] ?? (ratesByKind[kind] = {total: 0, firstAt: now, lastAt: now,
            short: {startedAt: now, count: 0, max: 0}, long: {startedAt: now, count: 0, max: 0}});
        rates.total++;
        rates.lastAt = now;
        countInto(rates.short, SHORT_WINDOW_MS, now);
        countInto(rates.long, MINUTE_IN_MS, now);
    },
    // Logs the user's rates and forgets them, as their connection ends.
    flush: (user: User): void =>
    {
        const ratesByKind = ratesByUserID[user.id];
        if (!ratesByKind)
            return;
        delete ratesByUserID[user.id];

        for (const [kind, rates] of Object.entries(ratesByKind))
        {
            LogUtil.log("Edit rates", {userType: user.userType, kind, total: rates.total,
                maxPer10s: rates.short.max, maxPerMinute: rates.long.max,
                minutes: Math.round((rates.lastAt - rates.firstAt) / MINUTE_IN_MS)}, "medium", "info");
        }
    },
}

// Fixed windows, each opened by the first event after the last one closed.
function countInto(window: RateWindow, windowMs: number, now: number): void
{
    if (now - window.startedAt >= windowMs)
    {
        window.startedAt = now;
        window.count = 0;
    }
    window.count++;
    window.max = Math.max(window.max, window.count);
}

export default EditRateLogUtil;
