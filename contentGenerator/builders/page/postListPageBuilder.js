const fileUtil = require("../../utils/fileUtil.js");
const envUtil = require("../../utils/envUtil.js");
const TextFileBuilder = require("../textFileBuilder.js");
const PostPageBuilder = require("./postPageBuilder.js");
const Header = require("../chunk/header.js");
const Footer = require("../chunk/footer.js");
require("dotenv").config();

function PostListPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entries) => {
        for (const entry of entries)
        {
            const rawText = await fileUtil.read(`${entry.dirName}/source.txt`);
            const postInfoList = await new PostPageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const builder = new TextFileBuilder();

            builder.addLine(Header("library", "ThingsPool - " + entry.title, entry.title, "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", listRelativeURL));
            builder.addLine(`<a class="homeButton" href="${envUtil.getRootURL()}/library.html">Back</a>`);
            builder.addLine(`<h1>${entry.title}</h1>`);
            builder.addLine(`<div class="l_spacer"></div>`);

            for (let i = postInfoList.length-1; i >= 0; --i)
            {
                const postInfo = postInfoList[i];
                builder.addLine(`<a class="listEntry" href="${envUtil.getRootURL()}/${entry.dirName}/page-${postInfo.pageNumber}.html">${postInfo.title}</a>`);
            }
            
            builder.addLine(Footer());
            
            await builder.build(listRelativeURL);
            sitemapBuilder.addEntry(listRelativeURL, postInfoList.sort((info1, info2) => info2.lastmod - info1.lastmod).pop().lastmod);
        }
    };
}

module.exports = PostListPageBuilder;