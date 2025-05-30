import envUtil from "../../../util/envUtil";
import ejsUtil from "../../../util/ejsUtil";
import textFileBuilder from "../textFileBuilder";
import gamePageBuilder from "./gamePageBuilder";
import uiConfig from "../../../config/uiConfig";
import dotenv from "dotenv";
import sitemapBuilder from "../sitemapBuilder";
import atomFeedBuilder from "../atomFeedBuilder";
dotenv.config();

export default class arcadePageBuilder
{
    private gameEntries: gameEntry[] = [
        {
            dirName: "ArtRaider",
            title: "ArtRaider",
            playLinkImagePathOverride: "badge_onestore.png",
            playLinkURL: "https://onesto.re/0001000383",
            videoTag: `<iframe width="560" height="315" src="https://www.youtube.com/embed/RuLgOJrNtKA?si=Ts_Yu_jdpB1qmNiT" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
            lastmod: "2025-04-15",
        },
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
    private sitemapBuilder: sitemapBuilder;
    private atomFeedBuilder: atomFeedBuilder;

    constructor(sitemapBuilder: sitemapBuilder, atomFeedBuilder: atomFeedBuilder)
    {
        this.sitemapBuilder = sitemapBuilder;
        this.atomFeedBuilder = atomFeedBuilder;
    }
    
    async build(): Promise<void>
    {
        const builder = new textFileBuilder();

        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
            menuName: "arcade",
            desc: "Games made by ThingsPool.",
            keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
            pagePathList: [
                {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                {title: uiConfig.displayText.menuName["arcade"], relativeURL: undefined},
            ],
            backDestination_href: envUtil.getRootURL(),
        }));

        builder.addLine(`<hr>`);
        builder.addLine(`<h1>Games</h1>`);
        
        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/info/gameLinks.ejs"));
        builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));

        this.sitemapBuilder.addEntry("arcade.html", "2025-02-28");

        await builder.build("arcade.html");

        for (const entry of this.gameEntries)
            await new gamePageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
    }
}