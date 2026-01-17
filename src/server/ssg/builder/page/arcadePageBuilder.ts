import EJSUtil from "../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import ArcadeGamePageBuilder from "./arcadeGamePageBuilder";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import { ArcadeData } from "../../data/arcadeData";
dotenv.config();

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
        const builder = new TextFileBuilder();

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/arcade.ejs", {
            entries: ArcadeData.gameEntries,
        }));
        await builder.build("arcade.html");

        this.sitemapBuilder.addEntry("arcade.html", "2025-02-28");

        for (const entry of ArcadeData.gameEntries)
            await new ArcadeGamePageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
    }
}