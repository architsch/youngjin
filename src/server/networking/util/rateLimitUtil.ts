import rateLimit from "express-rate-limit";
import LogUtil from "../../../shared/system/util/logUtil";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

// Dev traffic all comes from 127.0.0.1 and bursts (e.g. E2E), so dev uses a high ceiling. The limiter
// stays active so its headers remain testable.
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
