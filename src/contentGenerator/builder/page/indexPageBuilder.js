const envUtil = require("../../../server/util/envUtil.js");
const ejsUtil = require("../../../server/util/ejsUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
require("dotenv").config();

function IndexPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async () => {
        const builder = new TextFileBuilder();

        builder.addLine(await ejsUtil.createHTMLStringFromEJS("chunk/header.ejs", {
            pageName: "index",
            title: "ThingsPool",
            desc: "ThingsPool is a developer of experimental software and tools.",
            keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
            relativePageURL: undefined,
            ogImageURLOverride: undefined,
        }));
        builder.addLine(`<h3>Login feature is coming soon... (<a href="https://github.com/architsch/youngjin">Current Progress</a>)</h3>`);
        builder.addLine(await ejsUtil.createHTMLStringFromEJS("chunk/featureLinks.ejs"));
        builder.addLine(await ejsUtil.createHTMLStringFromEJS("chunk/gameLinks.ejs"));
        builder.addLine(await ejsUtil.createHTMLStringFromEJS("chunk/footer.ejs"));

        await builder.build("index.html");
    };
}

module.exports = IndexPageBuilder;