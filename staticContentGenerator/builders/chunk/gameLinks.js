const envUtil = require("../../utils/envUtil.js");
require("dotenv").config();

function GameLinks()
{
    const lines = [];

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

    const addGameLink = (gameTitle, gameURL, imageURL) => {
        lines.push(`<a class="noTextDeco" href="${gameURL}">`);
        lines.push(`<img class="gameLink" src="${imageURL}" alt="${gameTitle}">`);
        lines.push(`</a>`);
    };

    lines.push(`<h1>Games</h1>`);
    for (const e of gameEntries)
        addGameLink(e.title, `${envUtil.getRootURL()}/${e.dirName}/page.html`, `${envUtil.getRootURL()}/${e.dirName}/entry.jpg`);
    lines.push(`<div class="s_spacer"></div>`);

    return lines.join("\n");
}

module.exports = GameLinks;