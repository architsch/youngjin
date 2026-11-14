import FileUtil from "../../ssg/util/fileUtil";
import { URL_STATIC } from "../../system/serverConstants";
import AtomFeedBuilder from "./atomFeedBuilder";

// The Atom feed's entries again as RSS 2.0, for the readers and directories that take only RSS (I ♥ RSS).
export default class RssFeedBuilder
{
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(atomFeedBuilder: AtomFeedBuilder)
    {
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(): Promise<void>
    {
        const lines = [
            `<?xml version="1.0" encoding="utf-8"?>`,
            `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
            `<channel>`,
            `<title>ThingsPool</title>`,
            // I ♥ RSS lists a feed only if the page named here advertises it and links back to I ♥ RSS.
            `<link>${URL_STATIC}/library.html</link>`,
            `<description>A collection of essays and thought experiments, which cover a wide range of subjects including computer science, game design, logic, philosophy, and art.</description>`,
            `<lastBuildDate>${this.atomFeedBuilder.getLatestUpdate().toUTCString()}</lastBuildDate>`,
            `<atom:link href="${URL_STATIC}/rss.xml" rel="self" type="application/rss+xml"/>`,
        ];

        for (const entry of this.atomFeedBuilder.getEntriesNewestFirst())
        {
            lines.push(`<item>`);
            lines.push(`  <title>${entry.title}</title>`);
            lines.push(`  <link>${entry.url}</link>`);
            lines.push(`  <guid isPermaLink="true">${entry.url}</guid>`);
            lines.push(`  <pubDate>${entry.date.toUTCString()}</pubDate>`);
            lines.push(`  <description>${entry.description}</description>`);
            lines.push(`</item>`);
        }
        lines.push(`</channel>`);
        lines.push(`</rss>`);

        await FileUtil.write(`rss.xml`, lines.join("\n"));
    }
}
