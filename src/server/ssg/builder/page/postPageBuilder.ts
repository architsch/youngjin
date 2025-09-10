import FileUtil from "../../../util/fileUtil";
import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import UIConfig from "../../../../shared/config/uiConfig";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class PostPageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(entry: any): Promise<PostInfo[]>
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
        
        let builder = new TextFileBuilder();

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
                    builder.addLine(`<div class="snippet"><pre><code>${paragraphLinesPending.join("\n")}</code></pre></div>`);
                else if (excerptOn)
                    builder.addLine(`<pre><div class="excerpt">${paragraphLinesPending.join("\n")}</div></pre>`);
                else
                    builder.addLine(`<p>${paragraphLinesPending.join("<br>")}</p>`);
                paragraphLinesPending.length = 0;
            }
        };

        const buildPostPage = async (title: string, lastmod: string, desc: string, keywords: string) => {
            const listRelativeURL = `${entry.dirName}/list.html`;
            const postRelativeURL = `${entry.dirName}/page-${pageNumber}.html`;

            const builder_wrapper = new TextFileBuilder();
            builder_wrapper.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/header.ejs", {
                title: title,
                desc: desc,
                keywords: keywords,
                ogImageURLOverride: customOGImagePath,
                url: `${process.env.URL_STATIC}/${postRelativeURL}`,
                ogType: "article",
                pageName: "library",
                pagePathList: [
                    {title: UIConfig.displayText.pageName["index"], url: process.env.URL_STATIC},
                    {title: UIConfig.displayText.pageName["library"], url: `${process.env.URL_STATIC}/library.html`},
                    {title: entry.title, url: `${process.env.URL_STATIC}/${listRelativeURL}`},
                    {title: title, url: undefined},
                ],
                backDestination_href: `${process.env.URL_STATIC}/${listRelativeURL}`,
            }));

            builder_wrapper.addLine(builder.getText());
            builder_wrapper.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/footer.ejs"));
            await builder_wrapper.build(postRelativeURL);
            builder = new TextFileBuilder();

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
                    await buildPostPage(prev_title, prev_lastmod, prev_desc, prev_keywords);
                    prev_desc = desc;
                    prev_keywords = keywords;
                    prev_lastmod = lastmod;
                }
                isFirstArticle = false;

                builder.addLine(`<h1>${title}</h1>`);
                builder.addLine(`<p class="dim">Author: Youngjin Kang&nbsp;&nbsp;&nbsp;Date: ${date}</p>`);
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
                    builder.addLine(`<img class="m_image" src="${imgPath}" alt="${title.replaceAll("\"", "&quot;")} (Figure ${imageNumber++})">`);
                }
            }
            else if (line.startsWith("@@")) // Custom HTML tag
            {
                builder.addLine(line.substring(2));
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

        await buildPostPage(title, lastmod, desc, keywords);

        return postInfoList;
    };
}