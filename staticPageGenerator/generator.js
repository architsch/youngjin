const fileUtil = require("./utils/fileUtil.js");

async function run()
{
    const sitemapBuilder = new (require("./builders/sitemapBuilder.js"))();
    const atomFeedBuilder = new (require("./builders/atomFeedBuilder.js"))();

    await new (require("./builders/page/indexPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/aboutPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/arcadePageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();
    await new (require("./builders/page/libraryPageBuilder.js"))(sitemapBuilder, atomFeedBuilder).build();

    await sitemapBuilder.build();
    await atomFeedBuilder.build();

    await fileUtil.write("style.css", require('./styles/styleDictionary.js'));
}

run();