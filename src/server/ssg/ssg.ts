import fileUtil from "../util/fileUtil";
import ejsUtil from "../util/ejsUtil";
import sitemapBuilder from "./builder/sitemapBuilder";
import atomFeedBuilder from "./builder/atomFeedBuilder";
import arcadePageBuilder from "./builder/page/arcadePageBuilder";
import libraryPageBuilder from "./builder/page/libraryPageBuilder";
import textFileBuilder from "./builder/textFileBuilder";
import embeddedScriptBuilder from "./builder/embeddedScriptBuilder";
import styleDictionary from "./style/styleDictionary";
import dotenv from "dotenv";
dotenv.config();

export default async function ssg(): Promise<void>
{
    console.log("SSG START");

    // Generate pages

    const sitemapB = new sitemapBuilder();
    const atomFeedB = new atomFeedBuilder();

    let tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/menu/index.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await tb.build("index.html");

    tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/menu/rooms.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await tb.build("rooms.html");

    tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/portfolio.ejs", {}));
    await tb.build("portfolio.html");

    tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/portfolio_minimal.ejs", {}));
    await tb.build("portfolio_minimal.html");

    tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/privacyPolicy.ejs", {}));
    await tb.build("privacy-policy.html");

    tb = new textFileBuilder();
    tb.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/termsOfService.ejs", {}));
    await tb.build("terms-of-service.html");

    await new arcadePageBuilder(sitemapB, atomFeedB).build();
    await new libraryPageBuilder(sitemapB, atomFeedB).build();

    await sitemapB.build();
    await atomFeedB.build();

    // Generate CSS

    await fileUtil.write("style.css", styleDictionary);

    // Generate embedded scripts

    await new embeddedScriptBuilder().build();

    console.log("SSG END");
}