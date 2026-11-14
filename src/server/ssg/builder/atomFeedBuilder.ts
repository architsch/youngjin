import FileUtil from "../../ssg/util/fileUtil";
import { GLOBAL_LAST_MOD, URL_STATIC } from "../../system/serverConstants";
import { FeedTopicData } from "../data/feedTopicData";

export default class AtomFeedBuilder
{
    private entries: { url: string, title: string, date: Date, description: string }[] = [];
    private globalLatestUpdate = new Date(GLOBAL_LAST_MOD as string);

    addEntry(url: string, title: string, lastmod: string, description: string): void
    {
        const date = new Date(lastmod);
        if (date > this.globalLatestUpdate)
            this.globalLatestUpdate = date;

        this.entries.push({ url, title, date, description });
    }

    // Newest first: some readers (Bridgy Fed) read only the top entries and skip old ones by their date.
    getEntriesNewestFirst()
    {
        return [...this.entries].reverse().sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    getLatestUpdate(): Date
    {
        return this.globalLatestUpdate;
    }

    async build(): Promise<void>
    {
        const entries = this.getEntriesNewestFirst();
        await this.writeFeed("feed.atom", "ThingsPool", "urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c", // uuid randomly generated
            this.globalLatestUpdate, entries);

        for (const [fileName, topic] of Object.entries(FeedTopicData))
        {
            const urls = topic.postPaths.map(path => `${URL_STATIC}/${path}`);
            const topicEntries = entries.filter(entry => urls.includes(entry.url));
            if (topicEntries.length != urls.length)
                throw new Error(`${fileName} lists a post the site doesn't have: ${urls.filter(url => !topicEntries.some(entry => entry.url == url)).join(", ")}`);
            await this.writeFeed(fileName, topic.title, `${URL_STATIC}/${fileName}`, topicEntries[0].date, topicEntries);
        }
    }

    private async writeFeed(fileName: string, title: string, id: string, updated: Date,
        entries: ReturnType<AtomFeedBuilder["getEntriesNewestFirst"]>): Promise<void>
    {
        const lines = [
            `<?xml version="1.0" encoding="utf-8"?>`,
            `<feed xmlns="http://www.w3.org/2005/Atom">`,
            `<title>${title}</title>`,
            `<link rel="self" type="application/atom+xml" href="${URL_STATIC}/${fileName}"/>`,
            `<link href="${URL_STATIC}"/>`,
            `<updated>${updated.toISOString()}</updated>`,
            `<author>`,
            `  <name>Youngjin Kang</name>`,
            `</author>`,
            `<id>${id}</id>`,
        ];

        // Each dated by <published>, the date by which those readers skip old entries.
        for (const entry of entries)
        {
            lines.push(`<entry>`);
            lines.push(`  <title>${entry.title}</title>`);
            lines.push(`  <link href="${entry.url}"/>`);
            lines.push(`  <id>${entry.url}</id>`); // not ideal to use the url as unique never changing id but there is no other id for each article.
            lines.push(`  <published>${entry.date.toISOString()}</published>`);
            lines.push(`  <updated>${entry.date.toISOString()}</updated>`);
            lines.push(`  <summary>${entry.description}</summary>`);
            lines.push(`</entry>`);
        }
        lines.push(`</feed>`);

        await FileUtil.write(fileName, lines.join("\n"));
    }
}
