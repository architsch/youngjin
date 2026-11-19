import FileUtil from "./util/fileUtil.ts";
import EJSUtil from "./util/ejsUtil.ts";
import SitemapBuilder from "./builder/sitemapBuilder.ts";
import AtomFeedBuilder from "./builder/atomFeedBuilder.ts";
import RssFeedBuilder from "./builder/rssFeedBuilder.ts";
import ArcadePageBuilder from "./builder/page/arcadePageBuilder.ts";
import LibraryPageBuilder from "./builder/page/libraryPageBuilder.ts";
import styleDictionary from "./style/styleDictionary.ts";

// A page made from its template alone, and the file it is written to.
const STANDALONE_PAGES: [templatePath: string, fileName: string][] = [
    ["page/static/portfolio.ejs", "portfolio.html"],
    ["page/static/portfolio_minimal.ejs", "portfolio_minimal.html"],
    ["page/static/privacyPolicy.ejs", "privacy-policy.html"],
    ["page/static/termsOfService.ejs", "terms-of-service.html"],
];

// Builds the whole site into its folder (see FileUtil): the pages, the feeds, the sitemap and the stylesheet.
export default async function SSG(): Promise<void>
{
    const sitemapB = new SitemapBuilder();
    const atomFeedB = new AtomFeedBuilder();

    await FileUtil.write("index.html", await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs"));
    // No lastmod: nothing records when the landing page last changed, and a guessed date would mislead crawlers.
    sitemapB.addEntry("");

    for (const [templatePath, fileName] of STANDALONE_PAGES)
        await FileUtil.write(fileName, await EJSUtil.createStaticHTMLFromEJS(templatePath));

    await new ArcadePageBuilder(sitemapB, atomFeedB).build();
    await new LibraryPageBuilder(sitemapB, atomFeedB).build();

    await sitemapB.build();
    await atomFeedB.build();
    await new RssFeedBuilder(atomFeedB).build();

    await FileUtil.write("style.css", styleDictionary);
}
