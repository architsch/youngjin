const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
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
        
        let cb = new HTMLChunkBuilder();

        let desc = "A writing by ThingsPool.";
        let keywords = "thingspool, free game, web game, html5 game, browser game, writing, article";
        let lastmod = process.env.GLOBAL_LAST_MOD;

        let prev_title = title;
        let prev_desc = desc;
        let prev_keywords = keywords;
        let prev_lastmod = lastmod;

        const endParagraph = () => {
            if (paragraphLinesPending.length > 0)
            {
                if (snippetOn)
                    cb.addLine(`<div class="snippet"><pre><code>${paragraphLinesPending.join("\n")}</code></pre></div>`);
                else if (excerptOn)
                    cb.addLine(`<pre><div class="excerpt">${paragraphLinesPending.join("\n")}</div></pre>`);
                else
                    cb.addLine(`<p>${paragraphLinesPending.join("<br>")}</p>`);
                paragraphLinesPending.length = 0;
            }
        };

        const buildPostPage = async (title, lastmod, desc, keywords) => {
            const postRelativeURL = `${entry.dirName}/page-${pageNumber}.html`;

            const cb_wrapper = new HTMLChunkBuilder();
            cb_wrapper.addHeader("library", title, desc, keywords, postRelativeURL, customOGImagePath);
            cb_wrapper.addLine(cb.getText());
            cb_wrapper.addFooter();
            await cb_wrapper.build(postRelativeURL);
            cb = new HTMLChunkBuilder();

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

                cb.addLine(`<div class="l_spacer"></div>`);
                cb.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}/${entry.dirName}/list.html">Back</a>`);
                cb.addLine(`<h1>${title}</h1>`);

                cb.addLine(`<h3 style="color:#707070">Author: Youngjin Kang</h3>`);
                cb.addLine(`<h3 style="color:#707070">Date: ${date}</h3>`);

                cb.addLine(`<div class="l_spacer"></div>`);
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
                    cb.addLine(`<img class="figureImage" src="${imgPath}" alt="${title.replaceAll("\"", "&quot;")} (Figure ${imageNumber++})">`);
                }
            }
            else if (line.startsWith("@@")) // Custom HTML tag
            {
                cb.addLine(line.substring(2));
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