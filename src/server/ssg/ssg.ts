import FileUtil from "../util/fileUtil";
import EJSUtil from "../util/ejsUtil";
import SitemapBuilder from "./builder/sitemapBuilder";
import AtomFeedBuilder from "./builder/atomFeedBuilder";
import ArcadePageBuilder from "./builder/page/arcadePageBuilder";
import LibraryPageBuilder from "./builder/page/libraryPageBuilder";
import TextFileBuilder from "./builder/textFileBuilder";
import EmbeddedScriptBuilder from "./builder/embeddedScriptBuilder";
import styleDictionary from "./style/styleDictionary";
import dotenv from "dotenv";
dotenv.config();

export default async function SSG(): Promise<void>
{
    console.log("SSG START");

    // Generate pages

    const sitemapB = new SitemapBuilder();
    const atomFeedB = new AtomFeedBuilder();

    let tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs", {
        url: process.env.URL_STATIC,
    }));
    await tb.build("index.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio.ejs", {
        url: `${process.env.URL_STATIC}/portfolio.html`,
    }));
    await tb.build("portfolio.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio_minimal.ejs", {}));
    await tb.build("portfolio_minimal.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/privacyPolicy.ejs", {
        url: `${process.env.URL_STATIC}/privacy-policy.html`,
    }));
    await tb.build("privacy-policy.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/termsOfService.ejs", {
        url: `${process.env.URL_STATIC}/terms-of-service.html`,
    }));
    await tb.build("terms-of-service.html");

    // Static version of 'mypage' (in case the dynamic web app is currently not available)
    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/dynamic/mypage.ejs", {
        url: `${process.env.URL_STATIC}/mypage.html`,
    }));
    await tb.build("mypage.html");

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