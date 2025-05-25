import fileUtil from "../../../util/fileUtil";
import envUtil from "../../../util/envUtil";
import ejsUtil from "../../../util/ejsUtil";
import textFileBuilder from "../textFileBuilder";
import uiConfig from "../../../config/uiConfig";
import dotenv from "dotenv";
import sitemapBuilder from "../sitemapBuilder";
import atomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class gamePageBuilder
{
    private sitemapBuilder: sitemapBuilder;
    private atomFeedBuilder: atomFeedBuilder;

    constructor(sitemapBuilder: sitemapBuilder, atomFeedBuilder: atomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(entry: gameEntry): Promise<void>
    {
        let builder = new textFileBuilder();

        const relativeURL = `${entry.dirName}/page.html`;
        const rawText = await fileUtil.read(`${entry.dirName}/source.txt`);
        const lines = rawText.split(/\r?\n/);

        const playLinkImagePath = (entry.playLinkImagePathOverride == undefined) ? "play.png" : entry.playLinkImagePathOverride;

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

        builder = new textFileBuilder();
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

        builder.addLine(`<a class="noTextDeco" target="_blank" href="${entry.playLinkURL}">`);
        builder.addLine(`<img class="xs_image" src="${envUtil.getRootURL()}/${playLinkImagePath}" alt="Play">`);
        builder.addLine(`</a>`);
        builder.addLine(`<div class="zero_row"></div>`);

        let imageIndex = 1;
        const paragraphLinesPending: string[] = [];

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
                const paragraphTitle = (line.match(/\[(.*?)\]/) as string[])[1].trim();
                if (paragraphTitle.length > 0)
                {
                    builder.addLine(`<h2>${paragraphTitle}</h2>`);
                }
            }
            else if (line.startsWith("<")) // image reference
            {
                endParagraph();
                const imgName = (line.match(/<(.*?)>/) as string[])[1];
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

        this.sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        this.atomFeedBuilder.addEntry(`${envUtil.getRootURL()}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await builder.build(relativeURL);
    };
}