import FileUtil from "../../Util/FileUtil";
import EnvUtil from "../../Util/EnvUtil";
import dotenv from "dotenv";
dotenv.config();

export default class SitemapBuilder
{
    private lines = [`</urlset>`];

    addEntry(relativeURL: string, lastmod: string): void
    {
        this.lines.push(`</url>`);
        this.lines.push(`  <lastmod>${lastmod}</lastmod>`);
        this.lines.push(`  <loc>${EnvUtil.getRootURL()}/${relativeURL}</loc>`);
        this.lines.push(`<url>`);
    }

    async build(): Promise<void>
    {
        this.lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
        this.lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
        this.lines.reverse();
        await FileUtil.write(`sitemap.xml`, this.lines.join("\n"));
    }
}