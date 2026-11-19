import EJSUtil from "../../util/ejsUtil.ts";
import FileUtil from "../../util/fileUtil.ts";
import LibraryPostPageBuilder from "./libraryPostPageBuilder.ts";
import type SitemapBuilder from "../sitemapBuilder.ts";
import type AtomFeedBuilder from "../atomFeedBuilder.ts";
import type PostEntry from "../../types/postEntry.ts";

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

            await FileUtil.write(listRelativeURL, await EJSUtil.createStaticHTMLFromEJS("page/static/libraryPostList.ejs", {
                entry, listRelativeURL, postInfoList
            }));

            this.sitemapBuilder.addEntry(listRelativeURL,
                postInfoList
                    .sort((info1, info2) => Date.parse(info2.lastmod) - Date.parse(info1.lastmod))
                    .pop()!.lastmod
            );
        }
    };
}