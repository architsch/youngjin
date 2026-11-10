import FileUtil from "../../ssg/util/fileUtil";
import { GLOBAL_LAST_MOD, URL_STATIC } from "../../system/serverConstants";

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

    async build(): Promise<void>
    {
        const lines = [
            `<?xml version="1.0" encoding="utf-8"?>`,
            `<feed xmlns="http://www.w3.org/2005/Atom">`,
            `<title>ThingsPool</title>`,
            `<link rel="self" type="application/atom+xml" href="${URL_STATIC}/feed.atom"/>`,
            `<link href="${URL_STATIC}"/>`,
            `<updated>${this.globalLatestUpdate.toISOString()}</updated>`,
            `<author>`,
            `  <name>Youngjin Kang</name>`,
            `</author>`,
            `<id>urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c</id>`, // uuid randomly generated
        ];

        // Newest first, each dated by <published>: some readers (Bridgy Fed) read only the top entries and skip old ones by that date.
        const entries = [...this.entries].reverse().sort((a, b) => b.date.getTime() - a.date.getTime());
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

        await FileUtil.write(`feed.atom`, lines.join("\n"));
    }
}
