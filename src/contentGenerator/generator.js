const fileUtil = require("../server/util/fileUtil.js");
require("dotenv").config();

async function run()
{
    // Generate pages

    const sitemapBuilder = new (require("./builder/sitemapBuilder.js"))();
    const atomFeedBuilder = new (require("./builder/atomFeedBuilder.js"))();

    await new (require("./builder/page/indexPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builder/page/aboutPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builder/page/arcadePageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builder/page/libraryPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();

    await sitemapBuilder.build();
    await atomFeedBuilder.build();

    // Generate CSS

    await fileUtil.write("style.css", require('./style/styleDictionary.js'));
}

run();