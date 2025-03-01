const fileUtil = require("../utils/fileUtil.js");
const envUtil = require("../utils/envUtil.js");
require("dotenv").config();

function HTMLChunkBuilder()
{
    const lines = [];

    const addFullscreenBarMenuButton = (currPageName, pageName, pageDisplayName) => {
        const classAttrib = `class="noTextDeco fullscreenBarMenuButton ${currPageName == pageName ? 'selected' : 'idle'}"`;
        const relativePageURL = (pageName == "index" && !envUtil.isDevMode()) ? "" : `${pageName}.html`;
        const clickResponseAttrib = `href="${envUtil.getRootURL()}/${relativePageURL}"`;
        lines.push(`<a ${classAttrib} ${clickResponseAttrib}>${pageDisplayName}</a>`);
    }

    this.addLine = (line) => {
        lines.push(line);
    };

    this.addHeader = (currPageName, title, desc, keywords, relativePageURL, ogImageURLOverride) => {
        title = title.replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        desc = desc.replaceAll("\"", "&quot;");
        keywords = keywords.replaceAll("\"", "&quot;");

        lines.push(`<!DOCTYPE html>`);
        lines.push(`<html>`);
        lines.push(`<head>`);
        lines.push(`<meta charset="utf-8">`);
        lines.push(`<meta name="description" content="${desc}">`);
        lines.push(`<meta name="keywords" content="${keywords}">`);
        lines.push(`<meta name="author" content="Youngjin Kang">`);
        lines.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
        lines.push(`<meta property="og:title" content="${title}"/>`);

        if (relativePageURL != undefined)
            lines.push(`<meta property="og:url" content="${envUtil.getRootURL()}/${relativePageURL}"/>`);
        else
            lines.push(`<meta property="og:url" content="${envUtil.getRootURL()}"/>`);

        if (relativePageURL != undefined)
            lines.push(`<meta property="og:type" content="article"/>`);
        else
            lines.push(`<meta property="og:type" content="website"/>`);

        lines.push(`<meta property="og:site_name" content="ThingsPool"/>`);
        lines.push(`<meta property="og:description" content="${desc}"/>`);

        if (ogImageURLOverride != undefined)
            lines.push(`<meta property="og:image" content="${ogImageURLOverride}"/>`);
        else
            lines.push(`<meta property="og:image" content="https://thingspool.net/share.jpg"/>`);

        lines.push(`<meta property="og:image:alt" content="${title}">`);

        if (!envUtil.isDevMode())
        {
            lines.push(`<!-- Google tag (gtag.js) -->`);
            lines.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=G-JL7KHR7HK8"></script>`);
            lines.push(`<script>`);
            lines.push(`window.dataLayer = window.dataLayer || [];`);
            lines.push(`function gtag(){dataLayer.push(arguments);}`);
            lines.push(`gtag('js', new Date());`);
            lines.push(`gtag('config', 'G-JL7KHR7HK8');`);
            lines.push(`</script>`);
        }
        
        lines.push(`<title>${title}</title>`);
        lines.push(`<link rel="shortcut icon" href="${envUtil.getRootURL()}/favicon.ico">`);
        lines.push(`<link rel="stylesheet" href="${envUtil.getRootURL()}/style.css">`);
        lines.push(`<link rel="author" href="https://www.linkedin.com/in/youngjin-kang-55321882">`);
        lines.push(`<link rel="alternate" type="application/atom+xml" href="${envUtil.getRootURL()}/feed.atom" title="Atom Feed">`);

        if (relativePageURL != undefined)
            lines.push(`<link rel="canonical" href="${envUtil.getRootURL()}/${relativePageURL}">`);

        lines.push(`</head>`);
        lines.push(`<body>`);

        lines.push(`<div class="fullscreenBar">`);
        lines.push(`<div class="fullscreenBarLogo">`);
        lines.push(`<img class="fullscreenBarLogoImage" src="${envUtil.getRootURL()}/logo_light.png" alt="ThingsPool Logo">`);
        lines.push(`</div>`);
        lines.push(`<div class="fullscreenBarMenu">`);
        addFullscreenBarMenuButton(currPageName, "index", "Home");
        addFullscreenBarMenuButton(currPageName, "arcade", "Arcade");
        addFullscreenBarMenuButton(currPageName, "library", "Library");
        addFullscreenBarMenuButton(currPageName, "about", "About Me");
        lines.push(`</div>`);
        lines.push(`</div>`);

        lines.push(`<div class="fullscreenPanel">`);
    };

    this.addFooter = () => {
        lines.push(`<footer>`);
        lines.push(`&copy 2019-2025 ThingsPool. All rights reserved.`);
        lines.push(`<div class="l_spacer"></div>`);
        lines.push(`</footer>`);
        lines.push(`</div>`);
        lines.push(`</body>`);
        lines.push(`</html>`);
    };

    this.getText = () => {
        return lines.join("\n");
    };

    this.build = async (relativeFilePath, rootDir = undefined) => {
        if (rootDir == undefined)
            rootDir = process.env.STATIC_PAGE_ROOT_DIR;
        await fileUtil.write(relativeFilePath, lines.join("\n"), rootDir);
    };
}

module.exports = HTMLChunkBuilder;