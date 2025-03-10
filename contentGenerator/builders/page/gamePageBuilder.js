const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const Header = require("../chunk/header.js");
const Footer = require("../chunk/footer.js");
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
        builder.addLine(Header("arcade", "ThingsPool - " + entry.title, description, keywords, relativeURL));
        builder.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}/arcade.html">Back</a>`);
        builder.addLine(`<h1>${entry.title}</h1>`);

        builder.addLine(`<a class="noTextDeco" href="${entry.playLinkURL}">`);
        builder.addLine(`<img class="playButton" src="${envUtil.getRootURL()}/play.png" alt="Play">`);
        builder.addLine(`</a>`);

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
                    builder.addLine(`<img class="gameImage" src="${imgPath}" alt="ThingsPool - ${entry.title} (Screenshot ${imageIndex++})">`);
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
            builder.addLine(`<div class="l_spacer"></div>`);
            builder.addLine(entry.videoTag);
        }

        builder.addLine(Footer());

        sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        atomFeedBuilder.addEntry(`${envUtil.getRootURL()}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await builder.build(relativeURL);
    };
}

module.exports = GamePageBuilder;