const fileUtil = require("../../utils/fileUtil.js");
const HTMLChunkBuilder = require("../htmlChunkBuilder.js");
const PostPageBuilder = require("./postPageBuilder.js");
require("dotenv").config();

function PostListPageBuilder(sitemapBuilder, atomFeedBuilder)
{
    this.build = async (entries) => {
        for (const entry of entries)
        {
            const rawText = await fileUtil.read(`${entry.dirName}/source.txt`);
            const postInfoList = await new PostPageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);
            const listRelativeURL = `${entry.dirName}/list.html`;

            const cb = new HTMLChunkBuilder();

            cb.addHeader("library", "ThingsPool - " + entry.title, entry.title, "thingspool, software toys, technical design, computer science, systems engineering, game design, game development", listRelativeURL);
            cb.addLine(`<div class="l_spacer"></div>`);
            cb.addLine(`<a class="homeButton" href="${process.env.ROOT_URL}">Home</a>`);
            cb.addLine(`<h1>${entry.title}</h1>`);
            cb.addLine(`<div class="l_spacer"></div>`);

            for (let i = postInfoList.length-1; i >= 0; --i)
            {
                const postInfo = postInfoList[i];
                cb.addLine(`<a class="listEntry" href="${process.env.ROOT_URL}/${entry.dirName}/page-${postInfo.pageNumber}.html">${postInfo.title}</a>`);
            }
            
            cb.addLine(`<a class="listEntry" href="${process.env.ROOT_URL}">... Other Works</a>`);
            cb.addFooter();
            
            await cb.build(listRelativeURL);
            sitemapBuilder.addEntry(listRelativeURL, postInfoList.sort((info1, info2) => info2.lastmod - info1.lastmod).pop());
        }
    };
}

module.exports = PostListPageBuilder;