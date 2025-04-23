const envUtil = require("../../../server/util/envUtil.js");
const ejsUtil = require("../../../server/util/ejsUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const PostPageBuilder = require("./postPageBuilder.js");
const uiConfig = require("../../../shared/config/uiConfig.mjs").uiConfig;
require("dotenv").config();

function PostListPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entries) => {
        for (const entry of entries)
        {
            const postInfoList = await new PostPageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const builder = new TextFileBuilder();

            builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/header.ejs", {
                menuName: "library",
                title: "ThingsPool - " + entry.title,
                desc: entry.title,
                keywords: "thingspool, software toys, technical design, computer science, systems engineering, game design, game development",
                relativePageURL: listRelativeURL,
                pagePathList: [
                    {title: uiConfig.displayText.menuName["index"], relativeURL: ""},
                    {title: uiConfig.displayText.menuName["library"], relativeURL: "library.html"},
                    {title: entry.title, relativeURL: undefined},
                ],
                backDestination_href: `${envUtil.getRootURL()}/library.html`,
            }));

            builder.addLine(`<h1>${entry.title}</h1>`);

            for (let i = postInfoList.length-1; i >= 0; --i)
            {
                const postInfo = postInfoList[i];
                builder.addLine(`<a class="postEntryButton" href="${envUtil.getRootURL()}/${entry.dirName}/page-${postInfo.pageNumber}.html">${postInfo.title}</a>`);
            }
            
            builder.addLine(await ejsUtil.createStaticHTMLFromEJS("chunk/common/footer.ejs"));
            
            await builder.build(listRelativeURL);
            sitemapBuilder.addEntry(listRelativeURL, postInfoList.sort((info1, info2) => info2.lastmod - info1.lastmod).pop().lastmod);
        }
    };
}

module.exports = PostListPageBuilder;