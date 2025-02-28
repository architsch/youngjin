const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
require("dotenv").config();

function GamePageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entry) => {
        let cb = new HTMLChunkBuilder();

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

        cb = new HTMLChunkBuilder();
        cb.addHeader("arcade", "ThingsPool - " + entry.title, description, keywords, relativeURL);
        cb.addLine(`<div class="l_spacer"></div>`);
        cb.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}/arcade.html">Back</a>`);
        cb.addLine(`<h1>${entry.title}</h1>`);

        cb.addLine(`<a class="noTextDeco" href="${entry.playLinkURL}">`);
        cb.addLine(`<img class="playButton" src="${envUtil.getRootURL()}/play.png" alt="Play">`);
        cb.addLine(`</a>`);

        let imageIndex = 1;
        const paragraphLinesPending = [];

        const endParagraph = () => {
            if (paragraphLinesPending.length > 0)
            {
                cb.addLine(`<p>${paragraphLinesPending.join("<br>")}</p>`);
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
                    cb.addLine(`<h2>${paragraphTitle}</h2>`);
                }
            }
            else if (line.startsWith("<")) // image reference
            {
                endParagraph();
                const imgName = line.match(/<(.*?)>/)[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${envUtil.getRootURL()}/${entry.dirName}/${imgName}.jpg`;
                    cb.addLine(`<img class="gameImage" src="${imgPath}" alt="ThingsPool - ${entry.title} (Screenshot ${imageIndex++})">`);
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
            cb.addLine(`<div class="l_spacer"></div>`);
            cb.addLine(entry.videoTag);
        }

        cb.addFooter();

        sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        atomFeedBuilder.addEntry(`${envUtil.getRootURL()}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await cb.build(relativeURL);
    };
}

module.exports = GamePageBuilder;