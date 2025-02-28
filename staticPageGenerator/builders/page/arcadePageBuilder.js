const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
const GamePageBuilder = require("./gamePageBuilder.js");
require("dotenv").config();

function ArcadePageBuilder(sitemapBuilder, atomFeedBuilder)
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

    const addGameLink = (cb, gameTitle, gameURL, imageURL) => {
        cb.addLine(`<a class="noTextDeco" href="${gameURL}">`);
        cb.addLine(`<img class="gameLink" src="${imageURL}" alt="${gameTitle}">`);
        cb.addLine(`</a>`);
    };

    this.build = async () => {
        const cb = new HTMLChunkBuilder();

        cb.addHeader("arcade", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined);
        
        cb.addLine(`<h1>Games</h1>`);
        for (const e of gameEntries)
            addGameLink(cb, e.title, `${envUtil.getRootURL()}/${e.dirName}/page.html`, `${envUtil.getRootURL()}/${e.dirName}/entry.jpg`);
        cb.addLine(`<div class="s_spacer"></div>`);

        cb.addFooter();

        sitemapBuilder.addEntry("arcade.html", "2025-02-28");

        await cb.build("arcade.html");

        for (const entry of gameEntries)
            await new GamePageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);
    };
}

module.exports = ArcadePageBuilder;