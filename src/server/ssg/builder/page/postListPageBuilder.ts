import envUtil from "../../../util/envUtil";
import ejsUtil from "../../../util/ejsUtil";
import textFileBuilder from "../textFileBuilder";
import postPageBuilder from "./postPageBuilder";
import uiConfig from "../../../config/uiConfig";
import dotenv from "dotenv";
import sitemapBuilder from "../sitemapBuilder";
import atomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class postListPageBuilder
{
    private sitemapBuilder: sitemapBuilder;
    private atomFeedBuilder: atomFeedBuilder;

    constructor(sitemapBuilder: sitemapBuilder, atomFeedBuilder: atomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    
    async build(entries: postEntry[]): Promise<void>
    {
        for (const entry of entries)
        {
            const postInfoList = await new postPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const builder = new textFileBuilder();

            builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
                menuName: "library",
                title: "ThingsPool - " + entry.title,
                desc: entry.title,
                keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
                relativePageURL: listRelativeURL,
                pagePathList: [
                    {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                    {title: uiConfig.displayText.menuName["library"], relativeURL: "library.html"},
                    {title: entry.title, relativeURL: undefined},
                ],
                backDestination_href: `${envUtil.getRootURL()}/library.html`,
            }));

            builder.addLine(`<h1>${entry.title}</h1>`);

            for (let i = postInfoList.length-1; i >= 0; --i)
            {
                const postInfo = postInfoList[i];
                builder.addLine(`<a class="postEntryButton" href="${envUtil.getRootURL()}/${entry.dirName}/page-${postInfo.pageNumber}.html">${postInfo.title}</a>`);
            }
            
            builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));
            
            await builder.build(listRelativeURL);
            
            this.sitemapBuilder.addEntry(listRelativeURL,
                postInfoList
                    .sort((info1, info2) => Date.parse(info2.lastmod) - Date.parse(info1.lastmod))
                    .pop()!.lastmod
            );
        }
    };
}