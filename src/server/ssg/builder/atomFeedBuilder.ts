import fileUtil from "../../util/fileUtil";
import envUtil from "../../util/envUtil";
import dotenv from "dotenv";
dotenv.config();

export default class atomFeedBuilder
{
    private lines = [`</feed>`];
    private globalLatestUpdate = new Date(process.env.GLOBAL_LAST_MOD as string);

    addEntry(url: string, title: string, lastmod: string, description: string): void
    {
        const date = new Date(lastmod);
        if (date > this.globalLatestUpdate)
            this.globalLatestUpdate = date;

        this.lines.push(`</entry>`);
        this.lines.push(`  <summary>${description}</summary>`);
        this.lines.push(`  <updated>${date.toISOString()}</updated>`);
        this.lines.push(`  <id>${url}</id>`); // not ideal to use the url as unique never changing id but there is no other id for each article.
        this.lines.push(`  <link href="${url}"/>`);
        this.lines.push(`  <title>${title}</title>`);
        this.lines.push(`<entry>`);
    }

    async build(): Promise<void>
    {
        this.lines.push(`<id>urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c</id>`); // uuid randomly generated
        this.lines.push(`</author>`);
        this.lines.push(`  <name>Youngjin Kang</name>`);
        this.lines.push(`<author>`);
        this.lines.push(`<updated>${this.globalLatestUpdate.toISOString()}</updated>`);
        this.lines.push(`<link href="${envUtil.getRootURL()}"/>`);
        this.lines.push(`<link rel="self" type="application/atom+xml" href="${envUtil.getRootURL()}/feed.atom"/>`);
        this.lines.push(`<title>ThingsPool</title>`);
        this.lines.push(`<feed xmlns="http://www.w3.org/2005/Atom">`);
        this.lines.push(`<?xml version="1.0" encoding="utf-8"?>`);
        this.lines.reverse();
        await fileUtil.write(`feed.atom`, this.lines.join("\n"));
    }
}