const fileUtil = require("../server/util/fileUtil.js");
const ejsUtil = require("../server/util/ejsUtil.js");
const envUtil = require("../server/util/envUtil.js");
const TextFileBuilder = require("./builder/textFileBuilder.js");
require("dotenv").config();

async function run()
{
    // Generate pages

    const sitemapBuilder = new (require("./builder/sitemapBuilder.js"))();
    const atomFeedBuilder = new (require("./builder/atomFeedBuilder.js"))();

    let builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createHTMLStringFromEJS("page/index.ejs", {
        envUtil,
        ejsChunkRootPath: `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`,
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await builder.build("index.html");

    builder = new TextFileBuilder();
    builder.addLine(await ejsUtil.createHTMLStringFromEJS("page/social.ejs", {
        envUtil,
        ejsChunkRootPath: `${process.env.PWD}/${process.env.VIEWS_ROOT_DIR}/chunk`,
        isStaticPage: true,
        user: undefined,
        loginDestination: "",
    }));
    await builder.build("social.html");

    await new (require("./builder/page/arcadePageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builder/page/libraryPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();

    await sitemapBuilder.build();
    await atomFeedBuilder.build();

    // Generate CSS

    await fileUtil.write("style.css", require('./style/styleDictionary.js'));
}

module.exports.run = run;