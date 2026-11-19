import EJSUtil from "../../util/ejsUtil.ts";
import FileUtil from "../../util/fileUtil.ts";
import ArcadeGamePageBuilder from "./arcadeGamePageBuilder.ts";
import type SitemapBuilder from "../sitemapBuilder.ts";
import type AtomFeedBuilder from "../atomFeedBuilder.ts";
import { ArcadeData } from "../../data/arcadeData.ts";

export default class ArcadePageBuilder
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
        await FileUtil.write("arcade.html", await EJSUtil.createStaticHTMLFromEJS("page/static/arcade.ejs", {
            entries: ArcadeData.gameEntries,
        }));

        this.sitemapBuilder.addEntry("arcade.html", "2025-02-28");

        for (const entry of ArcadeData.gameEntries)
            await new ArcadeGamePageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
    }
}