// Matches self-identifying crawlers and link-preview fetchers (hidden bots aren't the target).
const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|robot|crawling/i;

const BotDetectionUtil =
{
    isBot: (userAgent: string | undefined): boolean =>
    {
        return userAgent != undefined && BOT_USER_AGENT_PATTERN.test(userAgent);
    },
}

export default BotDetectionUtil;
