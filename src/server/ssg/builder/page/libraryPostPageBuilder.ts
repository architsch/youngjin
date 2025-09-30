import FileUtil from "../../../util/fileUtil";
import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import PostEntry from "../../types/postEntry"
import PostInfo from "../../types/postInfo"
dotenv.config();

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
        const paragraphLinesPending: string[] = [];

        const postInfoList: PostInfo[] = [];
        
        let contentLines: string[] = [];

        let desc = "A writing by ThingsPool.";
        let keywords = "thingspool, software, engineering, philosophy";
        let lastmod = process.env.GLOBAL_LAST_MOD as string;

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

        const buildPostPage = async (title: string, lastmod: string, desc: string, keywords: string, isLastPage: boolean) => {
            const postRelativeURL = `${entry.dirName}/page-${pageNumber}.html`;

            const builder = new TextFileBuilder();
            builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/libraryPost.ejs", {
                title, desc, keywords, customOGImagePath, entry, pageNumber,
                isLastPage, content: contentLines.join("\n"),
            }));

            await builder.build(postRelativeURL);
            contentLines.length = 0;

            this.sitemapBuilder.addEntry(postRelativeURL, lastmod);
            this.atomFeedBuilder.addEntry(`${process.env.URL_STATIC}/${postRelativeURL}`, title, lastmod, desc);

            postInfoList.push({ pageNumber, title, lastmod, desc, keywords, customOGImagePath });
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
                    await buildPostPage(prev_title, prev_lastmod, prev_desc, prev_keywords, false);
                    prev_desc = desc;
                    prev_keywords = keywords;
                    prev_lastmod = lastmod;
                }
                isFirstArticle = false;

                contentLines.push(`<h1>${title}</h1>`);
                contentLines.push(`<p class="dim">Author: Youngjin Kang&nbsp;&nbsp;&nbsp;Date: ${date}</p>`);
            }
            else if (line.startsWith("<") && !snippetOn && !excerptOn) // image reference
            {
                endParagraph();
                const imgName = (line.match(/<(.*?)>/) as string[])[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${process.env.URL_STATIC}/${entry.dirName}/${imgName}.jpg`;
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
            else // plain text
            {
                line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
                paragraphLinesPending.push(line);
            }
        }
        endParagraph();

        await buildPostPage(title, lastmod, desc, keywords, true);

        return postInfoList;
    };
}