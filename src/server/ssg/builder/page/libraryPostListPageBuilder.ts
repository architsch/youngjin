import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import LibraryPostPageBuilder from "./libraryPostPageBuilder";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import PostEntry from "../../types/postEntry";
dotenv.config();

export default class LibraryPostListPageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    
    async build(category: string, entries: PostEntry[]): Promise<void>
    {
        for (let i = 0; i < entries.length; ++i)
        {
            const entry = entries[i];
            const postInfoList = await new LibraryPostPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const builder = new TextFileBuilder();

            builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/libraryPostList.ejs", {
                entry, listRelativeURL, postInfoList
            }));

            await builder.build(`${entry.dirName}/list.html`);
            
            this.sitemapBuilder.addEntry(`${entry.dirName}/list.html`,
                postInfoList
                    .sort((info1, info2) => Date.parse(info2.lastmod) - Date.parse(info1.lastmod))
                    .pop()!.lastmod
            );
        }
    };
}