const fileUtil = require("../../utils/fileUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
const GamePageBuilder = require("./gamePageBuilder.js");
const PostListPageBuilder = require("./postListPageBuilder.js");
require("dotenv").config();

function LibraryPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    const gameEntries = [
        {
            dirName: "Water-vs-Fire",
            title: "Water vs Fire",
            playLinkURL: "https://www.gamearter.com/game/water-vs-fire",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/6DeA_m8Iq4M?si=hC1uzkEtBWpYcM8z" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "HuntLand",
            title: "HuntLand",
            playLinkURL: "https://www.gamearter.com/game/huntland",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/3dRg6vvoPqc?si=FlnKVyzQq0_55sL2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "PoliceChase",
            title: "Police Chase",
            playLinkURL: "https://www.gamearter.com/game/policechase",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/kABg0j2mZqQ?si=3-JUZQnh3omVXSJd" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-10",
        },
        {
            dirName: "SpaceTown",
            title: "SpaceTown",
            playLinkURL: "https://www.gamearter.com/game/spacetown",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/NoiQzEKJM-A?si=o8vTNqW1kxCJ4MnW" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
            lastmod: "2023-09-20",
        },
    ];

    const nonfictionEntries = [
        { dirName: "metaphysics", title: "형이상학 (2013 - 2014)"},
        { dirName: "game-analysis", title: "게임분석 (2019)"},
        { dirName: "essays", title: "Miscellaneous Writings (2022 - 2024)"},
        { dirName: "blockchains", title: "On Legitimacy of Blockchains (2022)"},
        { dirName: "software-development", title: "Software Development (2022 - 2024)"},
        { dirName: "game-design", title: "Universal Laws of Game Design (2023)"},
        { dirName: "reality", title: "The Origin of Reality (2023)"},
        { dirName: "bridge-to-math", title: "A Layman's Bridge to Mathematics (2024)"},
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
    const linkEntries = [
        { dirName: "read-rec", title: "Recommended Readings (2024)"},
    ];

    const addPostLinks = (cb, title, entries) => {
        cb.addLine(`<h1>${title}</h1>`);

        for (let i = entries.length - 1; i >= 0; --i)
        {
            const entry = entries[i];
            cb.addLine(`<a class="listEntry" href="${process.env.ROOT_URL}/${entry.dirName}/list.html">${entry.title}</a>`);
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

        addPostLinks(cb, "Writings (Nonfiction)", nonfictionEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        addPostLinks(cb, "Writings (Fiction)", fictionEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        addPostLinks(cb, "Recommendations", linkEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        addPostLinks(cb, "Arts", artEntries);
        cb.addLine(`<div class="l_spacer"></div>`);

        cb.addLine(`<h1>Games</h1>`);
        for (const e of gameEntries)
            addGameLink(cb, e.title, `${process.env.ROOT_URL}/${e.dirName}/page.html`, `${process.env.ROOT_URL}/${e.dirName}/entry.jpg`);
        cb.addLine(`<div class="l_spacer"></div>`);

        /*cb.addLine(`<h1>Featured Articles</h1>`);
        addFeatureLink(cb, "Games in Prolog", `${process.env.ROOT_URL}/morsels/page-10.html`, `${process.env.ROOT_URL}/feat0.jpg`);
        addFeatureLink(cb, "Model of the Mind", `${process.env.ROOT_URL}/morsels/page-2.html`, `${process.env.ROOT_URL}/feat2.jpg`);
        addFeatureLink(cb, "Serious Game Design", `${process.env.ROOT_URL}/morsels/page-1.html`, `${process.env.ROOT_URL}/feat1.jpg`);
        addFeatureLink(cb, "Thought Simulator", `${process.env.ROOT_URL}/morsels/page-3.html`, `${process.env.ROOT_URL}/feat3.jpg`);
        cb.addLine(`<div class="l_spacer"></div>`);*/

        for (const entry of gameEntries)
            await new GamePageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);

        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(nonfictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(fictionEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(artEntries);
        await new PostListPageBuilder(sitemapBuilder, atomFeedBuilder).build(linkEntries);

        cb.addFooter();

        sitemapBuilder.addEntry("library.html", "2025-02-24");

        await cb.build("library.html");
    };
}

module.exports = LibraryPageBuilder;