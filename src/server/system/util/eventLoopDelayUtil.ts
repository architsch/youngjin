import { monitorEventLoopDelay } from "perf_hooks";
import LogUtil from "../../../shared/system/util/logUtil";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

const NS_PER_MS = 1e6;

// How long the event loop was held up, logged once a minute: every room runs on this one loop, so this is
// the baseline any server-side work is measured against.
const EventLoopDelayUtil =
{
    start: (): void =>
    {
        const histogram = monitorEventLoopDelay();
        histogram.enable();
        setInterval(() => {
            const toMs = (ns: number) => (ns / NS_PER_MS).toFixed(1);
            LogUtil.logRaw(`Event loop delay (ms) :: p50 = ${toMs(histogram.percentile(50))}, ` +
                `p99 = ${toMs(histogram.percentile(99))}, max = ${toMs(histogram.max)}`, "low", "info");
            histogram.reset();
        }, MINUTE_IN_MS);
    },
}

export default EventLoopDelayUtil;
