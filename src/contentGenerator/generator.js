const fileUtil = require("../server/util/fileUtil.js");
const ejsUtil = require("../server/util/ejsUtil.js");
const TextFileBuilder = require("./builder/textFileBuilder.js");
require("dotenv").config();

async function run()
{
    console.log("Generator START");

    // Generate pages

    const sitemapBuilder = new (require("./builder/sitemapBuilder.js"))();
    const atomFeedBuilder = new (require("./builder/atomFeedBuilder.js"))();

    let builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/menu/index.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await builder.build("index.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/menu/rooms.ejs", {
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await builder.build("rooms.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/portfolio.ejs", {}));
    await builder.build("portfolio.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/portfolio_minimal.ejs", {}));
    await builder.build("portfolio_minimal.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/privacyPolicy.ejs", {}));
    await builder.build("privacy-policy.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createStaticHTMLFromEJS("page/misc/termsOfService.ejs", {}));
    await builder.build("terms-of-service.html");

    await new (require("./builder/page/arcadePageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builder/page/libraryPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();

    await sitemapBuilder.build();
    await atomFeedBuilder.build();

    // Generate CSS

    await fileUtil.write("style.css", require('./style/styleDictionary.js'));

    console.log("Generator END");
}

module.exports.run = run;