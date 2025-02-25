const fileUtil = require("../../utils/fileUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
require("dotenv").config();

function StaticIndexPageBuilder(sitemapBuilder, atomFeedBuilder)
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

    const addFeatureLink = (cb, featureTitle, featureURL, imageURL) => {
        cb.addLine(`<a class="noTextDeco" href="${featureURL}">`);
        cb.addLine(`<img class="featureLink" src="${imageURL}" alt="${featureTitle}">`);
        cb.addLine(`</a>`);
    };

    this.build = async () => {
        const cb = new HTMLChunkBuilder();

        cb.addHeader("", "ThingsPool", "ThingsPool is a developer of experimental software and tools.", "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", undefined);
        
        cb.addLine(`<h1>Games</h1>`);
        for (const e of gameEntries)
            addGameLink(cb, e.title, `${process.env.ROOT_URL}/${e.dirName}/page.html`, `${process.env.ROOT_URL}/${e.dirName}/entry.jpg`);
        cb.addLine(`<div class="s_spacer"></div>`);

        cb.addLine(`<h1>Featured Articles</h1>`);
        addFeatureLink(cb, "Games in Prolog", `${process.env.ROOT_URL}/morsels/page-10.html`, `${process.env.ROOT_URL}/feat0.jpg`);
        addFeatureLink(cb, "Model of the Mind", `${process.env.ROOT_URL}/morsels/page-2.html`, `${process.env.ROOT_URL}/feat2.jpg`);
        addFeatureLink(cb, "Serious Game Design", `${process.env.ROOT_URL}/morsels/page-1.html`, `${process.env.ROOT_URL}/feat1.jpg`);
        addFeatureLink(cb, "Thought Simulator", `${process.env.ROOT_URL}/morsels/page-3.html`, `${process.env.ROOT_URL}/feat3.jpg`);
        cb.addLine(`<div class="l_spacer"></div>`);

        cb.addFooter();

        await cb.build("index.html");
    };
}

module.exports = StaticIndexPageBuilder;