// Matches the part of a User-Agent by which an automated client names itself. Search engine
// crawlers and the link-preview fetchers behind chat clients and social networks all announce what
// they are here; the aim is not to catch a client that hides, but to recognise the ones that are
// honest about it, so they can be spared the things only a human visitor needs.
const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|robot|crawling/i;

const BotDetectionUtil =
{
    isBot: (userAgent: string | undefined): boolean =>
    {
        return userAgent != undefined && BOT_USER_AGENT_PATTERN.test(userAgent);
    },
}

export default BotDetectionUtil;
