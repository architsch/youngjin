import FileUtil from "../Util/FileUtil";
import EJSUtil from "../Util/EJSUtil";
import SitemapBuilder from "./Builder/SitemapBuilder";
import AtomFeedBuilder from "./Builder/AtomFeedBuilder";
import ArcadePageBuilder from "./Builder/Page/ArcadePageBuilder";
import LibraryPageBuilder from "./Builder/Page/LibraryPageBuilder";
import TextFileBuilder from "./Builder/TextFileBuilder";
import EmbeddedScriptBuilder from "./Builder/EmbeddedScriptBuilder";
import styleDictionary from "./Style/StyleDictionary";
import dotenv from "dotenv";
dotenv.config();

export default async function SSG(): Promise<void>
{
    console.log("SSG START");

    // Generate pages

    const sitemapB = new SitemapBuilder();
    const atomFeedB = new AtomFeedBuilder();

    let tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/menu/index.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await tb.build("index.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/menu/rooms.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await tb.build("rooms.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/misc/portfolio.ejs", {}));
    await tb.build("portfolio.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/misc/portfolio_minimal.ejs", {}));
    await tb.build("portfolio_minimal.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/misc/privacyPolicy.ejs", {}));
    await tb.build("privacy-policy.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/misc/termsOfService.ejs", {}));
    await tb.build("terms-of-service.html");

    await new ArcadePageBuilder(sitemapB, atomFeedB).build();
    await new LibraryPageBuilder(sitemapB, atomFeedB).build();

    await sitemapB.build();
    await atomFeedB.build();

    // Generate CSS

    await FileUtil.write("style.css", styleDictionary);

    // Generate embedded scripts

    await new EmbeddedScriptBuilder().build();

    console.log("SSG END");
}