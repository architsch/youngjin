import EJSUtil from "../../../util/ejsUtil";
import TextFileBuilder from "../textFileBuilder";
import GamePageBuilder from "./gamePageBuilder";
import UIConfig from "../../../../shared/config/uiConfig";
import dotenv from "dotenv";
import SitemapBuilder from "../sitemapBuilder";
import AtomFeedBuilder from "../atomFeedBuilder";
import { url } from "inspector";
dotenv.config();

export default class ArcadePageBuilder
{
    private gameEntries: GameEntry[] = [
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

        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/header.ejs", {
            desc: "Games made by ThingsPool.",
            keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
            url: `${process.env.URL_STATIC}/arcade.html`,
            pageName: "arcade",
            pagePathList: [
                {title: UIConfig.displayText.pageName["index"], url: process.env.URL_STATIC},
                {title: UIConfig.displayText.pageName["arcade"], url: undefined},
            ],
            backDestination_href: process.env.URL_STATIC,
        }));

        builder.addLine(`<hr>`);
        builder.addLine(`<h1>Games</h1>`);
        
        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/info/gameLinks.ejs"));
        builder.addLine(await EJSUtil.createStaticHTMLFromEJS("partial/common/footer.ejs"));

        this.sitemapBuilder.addEntry("arcade.html", "2025-02-28");

        await builder.build("arcade.html");

        for (const entry of this.gameEntries)
            await new GamePageBuilder(this.sitemapBuilder, this.atomFeedBuilder).build(entry);
    }
}