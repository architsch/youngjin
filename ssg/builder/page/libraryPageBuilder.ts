import EJSUtil from "../../util/ejsUtil.ts";
import FileUtil from "../../util/fileUtil.ts";
import LibraryPostListPageBuilder from "./libraryPostListPageBuilder.ts";
import type SitemapBuilder from "../sitemapBuilder.ts";
import type AtomFeedBuilder from "../atomFeedBuilder.ts";
import { LibraryData } from "../../data/libraryData.ts";

export default class LibraryPageBuilder
{
    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    async build(): Promise<void>
    {
        await FileUtil.write("library.html", await EJSUtil.createStaticHTMLFromEJS("page/static/library.ejs", {
            entriesByCategory: LibraryData.entriesByCategory,
        }));

        this.sitemapBuilder.addEntry("library.html", "2025-02-28");

        for (const [category, entries] of Object.entries(LibraryData.entriesByCategory))
            await new LibraryPostListPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(category, entries);
    }
}