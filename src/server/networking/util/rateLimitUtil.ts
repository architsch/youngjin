import rateLimit from "express-rate-limit";
import LogUtil from "../../../shared/system/util/logUtil";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";

const RateLimitUtil =
{
    // For page routes: 20 requests per minute per IP
    pageRateLimiter: rateLimit({
        windowMs: MINUTE_IN_MS,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many requests. Please try again later.",
        handler: (req, res, next, options) => {
            LogUtil.log("Page rate limit exceeded", { ip: req.ip, path: req.path }, "high", "warn");
            res.status(options.statusCode).send(options.message);
        },
    }),

    // For API routes: 20 requests per minute per IP
    apiRateLimiter: rateLimit({
        windowMs: MINUTE_IN_MS,
        limit: 20,
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
