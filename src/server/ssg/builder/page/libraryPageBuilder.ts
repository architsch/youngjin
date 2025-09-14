import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import LibraryPostListPageBuilder from "./libraryPostListPageBuilder";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import { LibraryData } from "../../data/libraryData";
dotenv.config();

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
        const builder = new TextFileBuilder();

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/library.ejs", {
            entriesByCategory: LibraryData.entriesByCategory,
        }));
        await builder.build("library.html");

        this.sitemapBuilder.addEntry("library.html", "2025-02-28");

        for (const [category, entries] of Object.entries(LibraryData.entriesByCategory))
            await new LibraryPostListPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(category, entries);
    }
}