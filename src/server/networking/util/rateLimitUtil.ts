import rateLimit from "express-rate-limit";
import LogUtil from "../../../shared/system/util/logUtil";

const RateLimitUtil =
{
    // For page routes (/mypage, /console): 30 requests per minute per IP
    pageRateLimiter: rateLimit({
        windowMs: 60 * 1000,
        limit: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: "Too many requests. Please try again later.",
        handler: (req, res, next, options) => {
            LogUtil.log("Page rate limit exceeded", { ip: req.ip, path: req.path }, "high", "warn");
            res.status(options.statusCode).send(options.message);
        },
    }),

    // For API routes (/user/*): 10 requests per minute per IP
    apiRateLimiter: rateLimit({
        windowMs: 60 * 1000,
        limit: 10,
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
