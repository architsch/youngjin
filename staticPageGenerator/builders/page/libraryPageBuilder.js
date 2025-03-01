const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
const PostListPageBuilder = require("./postListPageBuilder.js");
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

    const addPostLinks = (cb, title, entries) => {
        cb.addLine(`<h1>${title}</h1>`);

        for (let i = entries.length - 1; i >= 0; --i)
        {
            const entry = entries[i];
            cb.addLine(`<a class="listEntry" href="${envUtil.getRootURL()}/${entry.dirName}/list.html">${entry.title}</a>`);
        }
    };

    const addGameLink = (cb, gameTitle, gameURL, imageURL) => {
        cb.addLine(`<a class="noTextDeco" href="${gameURL}">`);
        cb.addLine(`<img class="gameLink" src="${imageURL}" alt="${gameTitle}">`);
        cb.addLine(`</a>`);
    };

    const addFeatureLink = (cb, featureTitle, featureURL, imageURL) => {
        cb.addLine(`<a class="noTextDeco" href="${featureURL}">`);
        cb.addLine(`<img class="featureLink" src="${imageURL}" alt="${featureTitle}">`);
        cb.addLine(`</a>`);
    };

    this.build = async () => {
        const cb = new HTMLChunkBuilder();

        cb.addHeader("library", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined);

        cb.addLine(`<div class="l_spacer"></div>`);
        cb.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}${envUtil.isDevMode() ? "/index.html" : ""}">Back</a>`);

        addPostLinks(cb, "Nonfiction", nonfictionEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        addPostLinks(cb, "Fiction", fictionEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        addPostLinks(cb, "Arts", artEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        cb.addFooter();

        sitemapBuilder.addEntry("library.html", "2025-02-28");

        await cb.build("library.html");

        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(nonfictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(fictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(artEntries);
    };
}

module.exports = LibraryPageBuilder;