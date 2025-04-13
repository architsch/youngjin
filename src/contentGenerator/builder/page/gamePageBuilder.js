const fileUtil = require("../../../server/util/fileUtil.js");
const envUtil = require("../../../server/util/envUtil.js");
const ejsUtil = require("../../../server/util/ejsUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const uiConfig = require("../../../shared/config/uiConfig.mjs").uiConfig;
require("dotenv").config();

function GamePageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entry) => {
        let builder = new TextFileBuilder();

        const relativeURL = `${entry.dirName}/page.html`;
        const rawText = await fileUtil.read(`${entry.dirName}/source.txt`);
        const lines = rawText.split(/\r?\n/);

        let description = "";
        let keywords = "";

        if (lines[0].startsWith(":d:"))
            description = lines[0].substring(3);
        else
            console.error(":d: is missing in -> " + entry.title);

        if (lines[1].startsWith(":k:"))
            keywords = lines[1].substring(3).toLowerCase().replaceAll("-", " ");
        else
            console.error(":k: is missing in -> " + entry.title);

        builder = new TextFileBuilder();
        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
            menuName: "arcade",
            title: "ThingsPool - " + entry.title,
            desc: description,
            keywords: keywords,
            relativePageURL: relativeURL,
            pagePathList: [
                {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                {title: uiConfig.displayText.menuName["arcade"], relativeURL: "arcade.html"},
                {title: entry.title, relativeURL: undefined},
            ],
            backDestination_href: `${envUtil.getRootURL()}/arcade.html`,
        }));

        builder.addLine(`<h1>${entry.title}</h1>`);

        builder.addLine(`<a class="noTextDeco" href="${entry.playLinkURL}">`);
        builder.addLine(`<img class="xs_image" src="${envUtil.getRootURL()}/play.png" alt="Play">`);
        builder.addLine(`</a>`);
        builder.addLine(`<div class="zero_row"></div>`);

        let imageIndex = 1;
        const paragraphLinesPending = [];

        const endParagraph = () => {
            if (paragraphLinesPending.length > 0)
            {
                builder.addLine(`<p>${paragraphLinesPending.join("<br>")}</p>`);
                paragraphLinesPending.length = 0;
            }
        };
        
        for (let i = 2; i < lines.length; ++i)
        {
            let line = lines[i];
            line = line.trim();

            if (line.length == 0) // empty line
            {
                endParagraph();
            }
            else if (line.startsWith("[")) // Paragraph Title
            {
                endParagraph();
                const paragraphTitle = line.match(/\[(.*?)\]/)[1].trim();
                if (paragraphTitle.length > 0)
                {
                    builder.addLine(`<h2>${paragraphTitle}</h2>`);
                }
            }
            else if (line.startsWith("<")) // image reference
            {
                endParagraph();
                const imgName = line.match(/<(.*?)>/)[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${envUtil.getRootURL()}/${entry.dirName}/${imgName}.jpg`;
                    builder.addLine(`<img class="m_image" src="${imgPath}" alt="ThingsPool - ${entry.title} (Screenshot ${imageIndex++})">`);
                }
            }
            else // plain text
            {
                line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
                paragraphLinesPending.push(line);
            }
        }
        endParagraph();
        if (entry.videoTag != null && entry.videoTag != undefined)
        {
            builder.addLine(entry.videoTag);
        }

        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));

        sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        atomFeedBuilder.addEntry(`${envUtil.getRootURL()}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await builder.build(relativeURL);
    };
}

module.exports = GamePageBuilder;