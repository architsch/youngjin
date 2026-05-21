import rateLimit from "express-rate-limit";
import LogUtil from "../../../shared/system/util/logUtil";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

// In dev mode the whole dev/test workload originates from a single IP (127.0.0.1) and
// legitimately bursts well past the production ceiling — e.g. the E2E suite loads the
// game page and hits API routes dozens of times within a minute. Applying the 20/min
// production limit there trips it and causes spurious failures, so dev uses a high
// ceiling. The limiter stays active (rate-limit headers are still emitted), so its
// behaviour remains testable.
const REQUESTS_PER_MINUTE = process.env.MODE == "dev" ? 1000 : 20;

const RateLimitUtil =
{
    // For page routes
    pageRateLimiter: rateLimit({
        windowMs: MINUTE_IN_MS,
        limit: REQUESTS_PER_MINUTE,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many requests. Please try again later.",
        handler: (req, res, next, options) => {
            LogUtil.log("Page rate limit exceeded", { ip: req.ip, path: req.path }, "high", "warn");
            res.status(options.statusCode).send(options.message);
        },
    }),

    // For API routes
    apiRateLimiter: rateLimit({
        windowMs: MINUTE_IN_MS,
        limit: REQUESTS_PER_MINUTE,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many requests. Please try again later.",
        handler: (req, res, next, options) => {
            LogUtil.log("API rate limit exceeded", { ip: req.ip, path: req.path }, "high", "warn");
            res.status(options.statusCode).send(options.message);
        },
    }),
};

export default RateLimitUtil;
