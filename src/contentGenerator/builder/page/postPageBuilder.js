const fileUtil = require("../../../server/util/fileUtil.js");
const envUtil = require("../../../server/util/envUtil.js");
const ejsUtil = require("../../../server/util/ejsUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const uiConfig = require("../../../shared/config/uiConfig.mjs").uiConfig;
require("dotenv").config();

function PostPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entry) => {
        let isFirstArticle = true;
        let title = "???";
        let pageNumber = 1;
        let imageNumber = 1;
        let customOGImagePath = undefined;
        let snippetOn = false;
        let excerptOn = false;
        const paragraphLinesPending = [];

        const postInfoList = [];
        
        let builder = new TextFileBuilder();

        let desc = "A writing by ThingsPool.";
        let keywords = "thingspool, software, engineering, philosophy";
        let lastmod = process.env.GLOBAL_LAST_MOD;

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

        const buildPostPage = async (title, lastmod, desc, keywords) => {
            const listRelativeURL = `${entry.dirName}/list.html`;
            const postRelativeURL = `${entry.dirName}/page-${pageNumber}.html`;

            const builder_wrapper = new TextFileBuilder();
            builder_wrapper.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
                menuName: "library",
                title: title,
                desc: desc,
                keywords: keywords,
                relativePageURL: postRelativeURL,
                ogImageURLOverride: customOGImagePath,
                pagePathList: [
                    {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                    {title: uiConfig.displayText.menuName["library"], relativeURL: "library.html"},
                    {title: entry.title, relativeURL: listRelativeURL},
                    {title: title, relativeURL: undefined},
                ],
                backDestination_href: `${envUtil.getRootURL()}/${listRelativeURL}`,
            }));

            builder_wrapper.addLine(builder.getText());
            builder_wrapper.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));
            await builder_wrapper.build(postRelativeURL);
            builder = new TextFileBuilder();

            sitemapBuilder.addEntry(postRelativeURL, lastmod);
            atomFeedBuilder.addEntry(`${envUtil.getRootURL()}/${postRelativeURL}`, title, lastmod, desc);

            postInfoList.push({ pageNumber, title, lastmod, desc, keywords, customOGImagePath });
            pageNumber++;
            imageNumber = 1;
            customOGImagePath = undefined;
        };

        const rawText = await fileUtil.read(`${entry.dirName}/source.txt`);
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
                title = line.match(/\[(.*?)\]/)[1].trim();

                const date = line.match(/\](.*?)$/)[1].trim();

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
                const imgName = line.match(/<(.*?)>/)[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${envUtil.getRootURL()}/${entry.dirName}/${imgName}.jpg`;
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

module.exports = PostPageBuilder;