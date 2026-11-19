// Self-declared crawlers and scanners, plus the link-preview fetchers and scripted clients that never say
// "bot" (hidden bots aren't the target). HeadlessChrome is left out on purpose: E2E and playtests arrive as it.
const BOT_USER_AGENT_PATTERN = new RegExp([
    "bot", "crawler", "spider", "robot", "crawling", "scan",
    "facebookexternalhit", "meta-external", "^WhatsApp/", "Cardyb", "Mastodon/", "Embedly", "Iframely",
    "Google-InspectionTool", "GoogleOther",
    "^curl/", "^Wget/", "^python-requests/", "^Go-http-client/", "aiohttp", "fasthttp",
].join("|"), "i");

const BotDetectionUtil =
{
    // Every browser sends a User-Agent, so a request without one is never a player.
    isBot: (userAgent: string | undefined): boolean =>
    {
        return !userAgent || BOT_USER_AGENT_PATTERN.test(userAgent);
    },
}

export default BotDetectionUtil;
