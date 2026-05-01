import FileUtil from "./util/fileUtil";
import EJSUtil from "./util/ejsUtil";
import SitemapBuilder from "./builder/sitemapBuilder";
import AtomFeedBuilder from "./builder/atomFeedBuilder";
import ArcadePageBuilder from "./builder/page/arcadePageBuilder";
import LibraryPageBuilder from "./builder/page/libraryPageBuilder";
import TextFileBuilder from "./builder/textFileBuilder";
import styleDictionary from "./style/styleDictionary";
import ErrorPageBuilder from "./builder/page/errorPageBuilder";

export default async function SSG(): Promise<void>
{
    console.log("SSG START");

    // ImageMapBuilder pulls in `sharp`, a native module that requires an x86-64-v2 CPU
    // baseline our prod VPS does not meet. Dynamic-importing it here keeps `sharp` out
    // of the static module graph reachable from server.ts, so the prod server (which
    // never calls SSG) never loads `sharp`.
    const { default: ImageMapBuilder } = await import("./builder/imageMapBuilder");

    // Generate pages

    const sitemapB = new SitemapBuilder();
    const atomFeedB = new AtomFeedBuilder();

    let tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs", {}));
    await tb.build("index.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio.ejs", {}));
    await tb.build("portfolio.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio_minimal.ejs", {}));
    await tb.build("portfolio_minimal.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/privacyPolicy.ejs", {}));
    await tb.build("privacy-policy.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/termsOfService.ejs", {}));
    await tb.build("terms-of-service.html");

    await new ArcadePageBuilder(sitemapB, atomFeedB).build();
    await new LibraryPageBuilder(sitemapB, atomFeedB).build();
    await new ErrorPageBuilder().build();

    await sitemapB.build();
    await atomFeedB.build();

    // Generate CSS

    await FileUtil.write("style.css", styleDictionary);

    // Generate Image Maps

    await new ImageMapBuilder({
        rootDirName: "texture_packs", mapName: "TexturePackImageMap",
        gridCellSize: 256, maxCols: 2,
    }).build();
    await new ImageMapBuilder({
        rootDirName: "canvas_images", mapName: "CanvasImageMap",
        gridCellSize: 128, maxCols: 4,
    }).build();

    console.log("SSG END");
}