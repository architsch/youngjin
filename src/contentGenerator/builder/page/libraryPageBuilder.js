const envUtil = require("../../../server/util/envUtil.js");
const ejsUtil = require("../../../server/util/ejsUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const PostListPageBuilder = require("./postListPageBuilder.js");
const uiConfig = require("../../../shared/config/uiConfig.mjs").uiConfig;
require("dotenv").config();

function LibraryPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    const nonfictionEntries = [
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
    const fictionEntries = [
        { dirName: "novels", title: "단편소설 (2012 - 2013)"},
        { dirName: "alien-job-interview", title: "Alien Job Interview (2022)"},
        { dirName: "infinite-treasures", title: "The Island of Infinite Treasures (2022)"},
        { dirName: "infsoc", title: "Influential Social Posts (2023)"},
        { dirName: "gamedev-journey", title: "A Game Developer's Journey (2023)"},
        { dirName: "sandwich", title: "Sandwich Engineering (2025)"},
    ];
    const artEntries = [
        { dirName: "illustrations", title: "Illustrations (2009 - 2014)"},
        { dirName: "cartoons", title: "Cartoons (2011 - 2015)"},
    ];

    const addPostLinks = (builder, title, entries) => {
        builder.addLine(`<hr>`);
        builder.addLine(`<h1>${title}</h1>`);

        for (let i = entries.length - 1; i >= 0; --i)
        {
            const entry = entries[i];
            builder.addLine(`<a class="postEntryButton" href="${envUtil.getRootURL()}/${entry.dirName}/list.html">${entry.title}</a>`);
        }
    };

    this.build = async () => {
        const builder = new TextFileBuilder();

        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
            menuName: "library",
            pagePathList: [
                {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                {title: uiConfig.displayText.menuName["library"], relativeURL: undefined},
            ],
            backDestination_href: envUtil.getRootURL(),
        }));

        addPostLinks(builder, "Nonfiction", nonfictionEntries);

        addPostLinks(builder, "Fiction", fictionEntries);

        addPostLinks(builder, "Arts", artEntries);

        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));

        sitemapBuilder.addEntry("library.html", "2025-02-28");

        await builder.build("library.html");

        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(nonfictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(fictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(artEntries);
    };
}

module.exports = LibraryPageBuilder;