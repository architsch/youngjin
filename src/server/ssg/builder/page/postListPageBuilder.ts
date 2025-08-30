import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import PostPageBuilder from "./postPageBuilder";
import UIConfig from "../../../../shared/config/uiConfig";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class PostListPageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    
    async build(entries: PostEntry[]): Promise<void>
    {
        for (const entry of entries)
        {
            const postInfoList = await new PostPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const builder = new TextFileBuilder();

            builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/header.ejs", {
                menuName: "library",
                title: "ThingsPool - " + entry.title,
                desc: entry.title,
                keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
                relativePageURL: listRelativeURL,
                pagePathList: [
                    {title: UIConfig.displayText.menuName["index"], relativeURL: ""},
                    {title: UIConfig.displayText.menuName["library"], relativeURL: "library.html"},
                    {title: entry.title, relativeURL: undefined},
                ],
                backDestination_href: `${process.env.ROOT_URL}/library.html`,
            }));

            builder.addLine(`<h1>${entry.title}</h1>`);

            for (let i = postInfoList.length-1; i >= 0; --i)
            {
                const postInfo = postInfoList[i];
                builder.addLine(`<a class="postEntryButton" href="${process.env.ROOT_URL}/${entry.dirName}/page-${postInfo.pageNumber}.html">${postInfo.title}</a>`);
            }
            
            builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/footer.ejs"));
            
            await builder.build(listRelativeURL);
            
            this.sitemapBuilder.addEntry(listRelativeURL,
                postInfoList
                    .sort((info1, info2) => Date.parse(info2.lastmod) - Date.parse(info1.lastmod))
                    .pop()!.lastmod
            );
        }
    };
}