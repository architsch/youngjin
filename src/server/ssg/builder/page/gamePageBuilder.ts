import FileUtil from "../../../util/fileUtil";
import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import UIConfig from "../../../../shared/config/uiConfig";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class GamePageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(entry: GameEntry): Promise<void>
    {
        let builder = new TextFileBuilder();

        const relativeURL = `${entry.dirName}/page.html`;
        const rawText = await FileUtil.read(`${entry.dirName}/source.txt`);
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

        builder = new TextFileBuilder();
        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/header.ejs", {
            title: "ThingsPool - " + entry.title,
            desc: description,
            keywords: keywords,
            url: `${process.env.URL_STATIC}/${relativeURL}`,
            pageName: "arcade",
            pagePathList: [
                {title: UIConfig.displayText.pageName["index"], url: process.env.URL_STATIC},
                {title: UIConfig.displayText.pageName["arcade"], url: `${process.env.URL_STATIC}/arcade.html`},
                {title: entry.title, url: undefined},
            ],
            backDestination_href: `${process.env.URL_STATIC}/arcade.html`,
        }));

        builder.addLine(`<h1>${entry.title}</h1>`);

        builder.addLine(`<a class="noTextDeco" target="_blank" href="${entry.playLinkURL}">`);
        builder.addLine(`<img class="xs_image" src="${process.env.URL_STATIC}/${playLinkImagePath}" alt="Play">`);
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
                    const imgPath = `${process.env.URL_STATIC}/${entry.dirName}/${imgName}.jpg`;
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

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/footer.ejs"));

        this.sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        this.atomFeedBuilder.addEntry(`${process.env.URL_STATIC}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await builder.build(relativeURL);
    };
}