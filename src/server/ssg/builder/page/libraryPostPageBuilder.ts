import FileUtil from "../../util/fileUtil";
import EJSUtil from "../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import PostEntry from "../../types/postEntry"
import PostInfo from "../../types/postInfo"
import { GLOBAL_LAST_MOD, URL_STATIC } from "../../../system/serverConstants";

// "Post-AI Computer Science - Volume 2", "Game Programming in Prolog - Part 5", "Alien Job Interview - 3"
const SERIES_TITLE = /^(.*\S)\s+-\s+(?:(Volume|Part|Chapter)\s+)?(\d+)$/;

export default class LibraryPostPageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(entry: PostEntry): Promise<PostInfo[]>
    {
        let isFirstArticle = true;
        let title = "???";
        let pageNumber = 1;
        let imageNumber = 1;
        let customOGImagePath: string | undefined = undefined;
        let snippetOn = false;
        let excerptOn = false;
        let bodyStart = 0;
        const paragraphLinesPending: string[] = [];

        // Rendered only after the whole list is parsed, because a page's series line points at a page that may come later.
        const parsedPages: { info: PostInfo, contentLines: string[], bodyStart: number }[] = [];

        const author = entry.author ?? "Youngjin Kang";

        let contentLines: string[] = [];

        let desc = "A writing by ThingsPool.";
        let keywords = "thingspool, software, engineering, philosophy";
        let lastmod = GLOBAL_LAST_MOD as string;

        let prev_title = title;
        let prev_desc = desc;
        let prev_keywords = keywords;
        let prev_lastmod = lastmod;

        const endParagraph = () => {
            if (paragraphLinesPending.length > 0)
            {
                if (snippetOn)
                    contentLines.push(`<div class="snippet"><pre><code>${paragraphLinesPending.join("\n")}</code></pre></div>`);
                else if (excerptOn)
                    contentLines.push(`<pre><div class="excerpt">${paragraphLinesPending.join("\n")}</div></pre>`);
                else
                    contentLines.push(`<p>${paragraphLinesPending.join("<br>")}</p>`);
                paragraphLinesPending.length = 0;
            }
        };

        const finishPostPage = (title: string, lastmod: string, desc: string, keywords: string) => {
            parsedPages.push({
                info: { pageNumber, title, lastmod, desc, keywords, customOGImagePath },
                contentLines: contentLines.slice(),
                bodyStart,
            });
            contentLines.length = 0;
            pageNumber++;
            imageNumber = 1;
            customOGImagePath = undefined;
        };

        const rawText = await FileUtil.read(`${entry.dirName}/source.txt`);
        const lines = rawText.split(/\r?\n/);

        for (let i = 0; i < lines.length; ++i)
        {
            let line = lines[i];
            if (!snippetOn && !excerptOn)
                line = line.trim();

            if (line.length == 0) // empty line
            {
                if (snippetOn || excerptOn)
                    paragraphLinesPending.push("\n");
                else
                    endParagraph();
            }
            else if (line.startsWith("[")) // header
            {
                endParagraph();
                if (!isFirstArticle)
                    prev_title = title;
                title = (line.match(/\[(.*?)\]/) as string[])[1].trim();

                const date = (line.match(/\](.*?)$/) as string[])[1].trim();

                if (!isFirstArticle)
                {
                    finishPostPage(prev_title, prev_lastmod, prev_desc, prev_keywords);
                    prev_desc = desc;
                    prev_keywords = keywords;
                    prev_lastmod = lastmod;
                }
                isFirstArticle = false;

                contentLines.push(`<h1>${title}</h1>`);
                contentLines.push(`<p class="dim">Author: ${author}&nbsp;&nbsp;&nbsp;Date: ${date}</p>`);
                bodyStart = contentLines.length;
            }
            else if (line.startsWith("<") && !snippetOn && !excerptOn) // image reference
            {
                endParagraph();
                const imgName = (line.match(/<(.*?)>/) as string[])[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${URL_STATIC}/${entry.dirName}/${imgName}.jpg`;
                    if (customOGImagePath == undefined || line.endsWith("*"))
                        customOGImagePath = imgPath;
                    contentLines.push(`<img class="l_image" src="${imgPath}" alt="${title.replaceAll("\"", "&quot;")} (Figure ${imageNumber++})">`);
                }
            }
            else if (line.startsWith("@@")) // Custom HTML tag
            {
                contentLines.push(line.substring(2));
            }
            else if (line.startsWith("#$")) // snippet
            {
                endParagraph();
                snippetOn = !snippetOn;
            }
            else if (line.startsWith("#\"")) // excerpt
            {
                endParagraph();
                excerptOn = !excerptOn;
            }
            else if (line.startsWith(":d:"))
            {
                if (!isFirstArticle)
                    prev_desc = desc;
                desc = line.substring(3);
            }
            else if (line.startsWith(":k:"))
            {
                if (!isFirstArticle)
                    prev_keywords = keywords;
                keywords = line.substring(3).toLowerCase().replaceAll("-", " ");
            }
            else if (line.startsWith(":l:"))
            {
                if (!isFirstArticle)
                    prev_lastmod = lastmod;
                lastmod = line.substring(3);
            }
            else if (line.startsWith(":stop:")) // "Stop" sign (i.e. "Stop reading lines beyond this point.")
            {
                break;
            }
            else // plain text
            {
                line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
                paragraphLinesPending.push(line);
            }
        }
        endParagraph();
        finishPostPage(title, lastmod, desc, keywords);

        const seriesStarts = LibraryPostPageBuilder.findSeriesStarts(parsedPages.map(page => page.info));

        for (let i = 0; i < parsedPages.length; ++i)
        {
            const page = parsedPages[i];
            const seriesLine = LibraryPostPageBuilder.makeSeriesLine(entry, page.info, seriesStarts);
            if (seriesLine != undefined)
                page.contentLines.splice(page.bodyStart, 0, seriesLine);

            const postRelativeURL = `${entry.dirName}/page-${page.info.pageNumber}.html`;

            const builder = new TextFileBuilder();
            builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/libraryPost.ejs", {
                title: page.info.title, desc: page.info.desc, keywords: page.info.keywords,
                customOGImagePath: page.info.customOGImagePath, entry, pageNumber: page.info.pageNumber,
                isLastPage: i == parsedPages.length - 1, content: page.contentLines.join("\n"),
            }));

            await builder.build(postRelativeURL);

            this.sitemapBuilder.addEntry(postRelativeURL, page.info.lastmod);
            this.atomFeedBuilder.addEntry(`${URL_STATIC}/${postRelativeURL}`, page.info.title, page.info.lastmod, page.info.desc);
        }

        return parsedPages.map(page => page.info);
    };

    // "Post-AI Computer Science - Volume 2" -> { name: "Post-AI Computer Science", part: "Volume 2", number: 2 }
    private static parseSeriesTitle(title: string): { name: string, part: string, number: number } | undefined
    {
        const match = title.match(SERIES_TITLE);
        if (match == null)
            return undefined;
        return { name: match[1], part: `${match[2] ?? "Part"} ${match[3]}`, number: parseInt(match[3]) };
    }

    // The lowest-numbered page of each series in this list, by series name.
    private static findSeriesStarts(infos: PostInfo[]): Map<string, PostInfo>
    {
        const starts = new Map<string, PostInfo>();
        for (const info of infos)
        {
            const series = LibraryPostPageBuilder.parseSeriesTitle(info.title);
            if (series == undefined)
                continue;
            const start = starts.get(series.name);
            if (start == undefined || series.number < LibraryPostPageBuilder.parseSeriesTitle(start.title)!.number)
                starts.set(series.name, info);
        }
        return starts;
    }

    // Tells a reader who lands mid-series where it begins.
    private static makeSeriesLine(entry: PostEntry, info: PostInfo, seriesStarts: Map<string, PostInfo>): string | undefined
    {
        const series = LibraryPostPageBuilder.parseSeriesTitle(info.title);
        const start = (series != undefined) ? seriesStarts.get(series.name) : undefined;
        if (series == undefined || start == undefined || start.pageNumber == info.pageNumber)
            return undefined;

        const startPart = LibraryPostPageBuilder.parseSeriesTitle(start.title)!.part;
        return `<p class="seriesLine">${series.part} of ${series.name}. The series begins with ` +
            `<a href="${URL_STATIC}/${entry.dirName}/page-${start.pageNumber}.html">${startPart}</a>.</p>`;
    }
}