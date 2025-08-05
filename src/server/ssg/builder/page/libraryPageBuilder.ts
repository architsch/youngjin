import EnvUtil from "../../../Util/EnvUtil";
import EJSUtil from "../../../Util/EJSUtil";
import TextFileBuilder from "../TextFileBuilder";
import PostListPageBuilder from "./PostListPageBuilder";
import UIConfig from "../../../../Shared/Config/UIConfig";
import dotenv from "dotenv";
import SitemapBuilder from "../SitemapBuilder";
import AtomFeedBuilder from "../AtomFeedBuilder";
dotenv.config();

export default class LibraryPageBuilder
{
    private nonfictionEntries: PostEntry[] = [
        { dirName: "metaphysics", title: "형이상학 (2013 - 2014)"},
        { dirName: "game-analysis", title: "게임분석 (2019)"},
        { dirName: "essays", title: "Miscellaneous Writings (2022 - 2024)"},
        { dirName: "blockchains", title: "On Legitimacy of Blockchains (2022)"},
        { dirName: "software-development", title: "Software Development (2022 - 2024)"},
        { dirName: "game-design", title: "Universal Laws of Game Design (2023)"},
        { dirName: "reality", title: "The Origin of Reality (2023)"},
        { dirName: "bridge-to-math", title: "A Layman's Bridge to Mathematics (2024)"},
        { dirName: "read-rec", title: "Recommended Readings (2024)"},
        { dirName: "morsels", title: "Morsels of Thought (2024)"},
        { dirName: "concepts-of-plan", title: "Concepts of a Plan (2025)"},
    ];
    private fictionEntries: PostEntry[] = [
        { dirName: "novels", title: "단편소설 (2012 - 2013)"},
        { dirName: "alien-job-interview", title: "Alien Job Interview (2022)"},
        { dirName: "infinite-treasures", title: "The Island of Infinite Treasures (2022)"},
        { dirName: "infsoc", title: "Influential Social Posts (2023)"},
        { dirName: "gamedev-journey", title: "A Game Developer's Journey (2023)"},
        { dirName: "sandwich", title: "Sandwich Engineering (2025)"},
    ];
    private artEntries: PostEntry[] = [
        { dirName: "illustrations", title: "Illustrations (2009 - 2014)"},
        { dirName: "cartoons", title: "Cartoons (2011 - 2015)"},
    ];

    private sitemapBuilder: SitemapBuilder;
    private atomFeedBuilder: AtomFeedBuilder;

    constructor(sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }

    addPostLinks(builder: TextFileBuilder, title: string, entries: PostEntry[]): void
    {
        builder.addLine(`<hr>`);
        builder.addLine(`<h1>${title}</h1>`);

        for (let i = entries.length - 1; i >= 0; --i)
        {
            const entry = entries[i];
            builder.addLine(`<a class="postEntryButton" href="${EnvUtil.getRootURL()}/${entry.dirName}/list.html">${entry.title}</a>`);
        }
    }

    async build(): Promise<void>
    {
        const builder = new TextFileBuilder();

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
            menuName: "library",
            pagePathList: [
                {title: UIConfig.displayText.menuName["index"], relativeURL: ""},
                {title: UIConfig.displayText.menuName["library"], relativeURL: undefined},
            ],
            backDestination_href: EnvUtil.getRootURL(),
        }));

        this.addPostLinks(builder, "Nonfiction", this.nonfictionEntries);
        this.addPostLinks(builder, "Fiction", this.fictionEntries);
        this.addPostLinks(builder, "Arts", this.artEntries);

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));

        this.sitemapBuilder.addEntry("library.html", "2025-02-28");

        await builder.build("library.html");

        await new PostListPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(this.nonfictionEntries);
        await new PostListPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(this.fictionEntries);
        await new PostListPageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(this.artEntries);
    }
}