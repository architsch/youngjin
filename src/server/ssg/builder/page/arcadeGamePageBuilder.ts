import FileUtil from "../../../util/fileUtil";
import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import GameEntry from "../../types/gameEntry"
dotenv.config();

export default class ArcadeGamePageBuilder
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

        const contentLines: string[] = [];

        let imageIndex = 1;
        const paragraphLinesPending: string[] = [];

        const endParagraph = () => {
            if (paragraphLinesPending.length > 0)
            {
                contentLines.push(`<p>${paragraphLinesPending.join("<br>")}</p>`);
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
                    contentLines.push(`<h2>${paragraphTitle}</h2>`);
                }
            }
            else if (line.startsWith("<")) // image reference
            {
                endParagraph();
                const imgName = (line.match(/<(.*?)>/) as string[])[1];
                if (imgName.length > 0)
                {
                    const imgPath = `${process.env.URL_STATIC}/${entry.dirName}/${imgName}.jpg`;
                    contentLines.push(`<img class="m_image" src="${imgPath}" alt="ThingsPool - ${entry.title} (Screenshot ${imageIndex++})">`);
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
            contentLines.push(entry.videoTag);
        }

        const builder = new TextFileBuilder();

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/arcadeGame.ejs", {
            entry, relativeURL, description, keywords, playLinkImagePath, content: contentLines.join("\n")
        }));

        this.sitemapBuilder.addEntry(relativeURL, entry.lastmod);
        this.atomFeedBuilder.addEntry(`${process.env.URL_STATIC}/${relativeURL}`, entry.title, entry.lastmod, entry.title);

        await builder.build(relativeURL);
    };
}