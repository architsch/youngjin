const css = require('./styleDictionary.js');

const fs = require('fs/promises');
const fss = require('fs');

const gameEntries = [
    ["Water-vs-Fire", "Water vs Fire", "https://www.gamearter.com/game/water-vs-fire", `<iframe width="560" height="315" src="https://www.youtube.com/embed/6DeA_m8Iq4M?si=hC1uzkEtBWpYcM8z" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`],
    ["HuntLand", "HuntLand", "https://www.gamearter.com/game/huntland", `<iframe width="560" height="315" src="https://www.youtube.com/embed/3dRg6vvoPqc?si=FlnKVyzQq0_55sL2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`],
    ["PoliceChase", "Police Chase", "https://www.gamearter.com/game/policechase", `<iframe width="560" height="315" src="https://www.youtube.com/embed/kABg0j2mZqQ?si=3-JUZQnh3omVXSJd" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`],
    ["SpaceTown", "SpaceTown", "https://www.gamearter.com/game/spacetown", `<iframe width="560" height="315" src="https://www.youtube.com/embed/ll-TAmGqilA?si=e3DLl06bEjohhc2X" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`],
];
const writingEntries = [
    ["Novels", "Novels (2012 - 2013)"],
    ["Metaphysics", "Metaphysics (2013 - 2014)"],
    ["Game-Analysis", "Game Analysis (2019)"],
    ["Essays-and-Novels", "Essays and Novels (2022 - 2023)"],
    ["Blockchains", "Blockchains (2022)"],
    ["Game-Design", "Game Design (2023)"],
];
const sitemapLines = [
    `</urlset>`,
];

async function run()
{
    const htmlLines = [];
    let relativeURL = "";

    //------------------------------------------------------------------------------------
    // Generate CSS
    //------------------------------------------------------------------------------------

    await write("style.css", css);

    //------------------------------------------------------------------------------------
    // Generate HTMLs for games
    //------------------------------------------------------------------------------------

    for (const gameEntry of gameEntries)
    {
        relativeURL = `${gameEntry[0]}/page.html`;
        await write(relativeURL, createHTMLForGame(gameEntry[1], gameEntry[2], gameEntry[3], await read(`${gameEntry[0]}/source.txt`)));
        addSitemapEntry(relativeURL);
    }

    //------------------------------------------------------------------------------------
    // Generate HTMLs for writings
    //------------------------------------------------------------------------------------

    for (let i = 0; i < writingEntries.length; ++i)
    {
        const code = writingEntries[i][0];

        const entryTitle = writingEntries[i][1];
        const rawText = await read(`${code}/source.txt`);
        const {fileIndices, fileTitles, fileTexts} = createHTMLsForWritings(rawText, code);

        htmlLines.length = 0;
        addHeaderHTML(htmlLines, "ThingsPool - " + entryTitle, 0, entryTitle, "ThingsPool, Game, Free, Blog, Writings, Articles");
        htmlLines.push(`<h3><a href="../index.html">&#171; Back</a></h3>`);
        htmlLines.push(`<h1>${entryTitle}</h1>`);
        addPromo(htmlLines, 0);

        for (let j = fileIndices.length-1; j >= 0; --j)
        {
            const fileIndex = fileIndices[j];
            const fileTitle = fileTitles[j];
            const fileText = fileTexts[j];
            const fileHTMLFileName = `page-${fileIndex}.html`;
            htmlLines.push(`<h3><a href="${fileHTMLFileName}">${fileTitle}</a></h3>`);

            relativeURL = `${code}/${fileHTMLFileName}`;
            await write(relativeURL, fileText);
            addSitemapEntry(relativeURL);
        }

        addFooterHTML(htmlLines, 0);

        relativeURL = `${code}/list.html`;
        await write(relativeURL, htmlLines.join("\n"));
        addSitemapEntry(relativeURL);
    }

    //------------------------------------------------------------------------------------
    // Generate index.html
    //------------------------------------------------------------------------------------

    htmlLines.length = 0;
    addHeaderHTML(htmlLines, "ThingsPool", -1, "ThingsPool is an indie game developer.", "ThingsPool, Game, Entertainment, Free, HTML5, RTS, FPS, Boardgame, Tabletop, Puzzle");

    htmlLines.push(`<img class="logoImage" src="logo.png" alt="ThingsPool Logo">`);
    htmlLines.push(`<div class="l_spacer"></div>`);

    htmlLines.push(`<h2 class="banner">Games</h2>`);
    addPromo(htmlLines, -1);

    htmlLines.push(`<h2 class="banner">Writings</h2>`);
    htmlLines.push(`<div class="l_spacer"></div>`);
    for (let i = writingEntries.length-1; i >= 0; --i)
    {
        const code = writingEntries[i][0];
        const entryName = writingEntries[i][1];
        htmlLines.push(`<h3><a href="${code}/list.html">${entryName}</a></h3>`);
    }
    htmlLines.push(`<div class="l_spacer"></div>`);
    htmlLines.push(`<h2 class="banner">About Myself</h2>`);
    htmlLines.push(`<div class="l_spacer"></div>`);
    htmlLines.push(`<img class="profileImage" src="profile.jpg" alt="Youngjin Kang">`);
    htmlLines.push(`<div class="l_spacer"></div>`);
    htmlLines.push(`<h3>Hello!</h3>`);
    htmlLines.push(`<p>My name is Youngjin, and I am a software engineer who develops computer games, simulations, and other types of interactive media. I studied electrical and electronics engineering at the University of Washington, and worked as a software developer in game development companies including Signal Studios (Bothell, WA), Valkyrie Entertainment (Seattle, WA), and Galactic Entertainment (United Kingdom).</p>`);
    htmlLines.push(`<p>ThingsPool is an independent game development studio which I have founded for the purpose of making and publishing videogames that are easily accessible and furnished with unique personalities.</p>`);
    htmlLines.push(`<div class="l_spacer"></div>`);
    htmlLines.push(`<h3><a href="https://www.linkedin.com/in/youngjin-kang-55321882/">LinkedIn Page</a></h3>`);
    htmlLines.push(`<h3><a href="https://www.pacogames.com/developers/thingspool">PacoGames Page</a></h3>`);

    addFooterHTML(htmlLines, -1);
    relativeURL = `index.html`;
    await write(relativeURL, htmlLines.join("\n"));
    addSitemapEntry(relativeURL);

    //------------------------------------------------------------------------------------
    // Generate sitemap.xml
    //------------------------------------------------------------------------------------

    sitemapLines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    sitemapLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    sitemapLines.reverse();
    await write(`sitemap.xml`, sitemapLines.join("\n"));
}

async function read(filepath)
{
    try
    {
        const data = await fs.readFile(filepath, {encoding: 'utf8'});
        return data;
    }
    catch (err)
    {
        console.error(err);
        return "";
    }
}

async function write(filepath, content)
{
    try
    {
        await fs.writeFile(filepath, content);
    }
    catch (err)
    {
        console.error(err);
    }
}

async function copyFile(sourcePath, targetPath)
{
    try
    {
        await fs.copyFile(sourcePath, targetPath);
    }
    catch (err)
    {
        console.error(err);
    }
}

async function mkdir(fileOrDirPath)
{
    try
    {
        if (!fss.existsSync(fileOrDirPath))
            await fs.mkdir(fileOrDirPath);
    }
    catch (err)
    {
        console.error(err);
    }
}

function addSitemapEntry(relativeURL)
{
    sitemapLines.push(`</url>`);
    sitemapLines.push(`<loc>https://thingspool.net/${relativeURL}</loc>`);
    sitemapLines.push(`<url>`);
}

function addHeaderHTML(htmlLines, title, pageDepth, description, keywords)
{
    if (description.indexOf("\"") >= 0)
        console.error("Description contains a double quote ---> " + description);
    if (keywords.indexOf("\"") >= 0)
        console.error("Keywords contains a double quote ---> " + keywords);
    
    let pageDepthRelativePath = "";
    for (let i = 0; i <= pageDepth; ++i)
        pageDepthRelativePath += "../";

    htmlLines.push(`<!DOCTYPE html>`);
    htmlLines.push(`<html>`);
    htmlLines.push(`<head>`);
    htmlLines.push(`<meta charset="utf-8">`);
    htmlLines.push(`<meta name="description" content="${description}">`);
    htmlLines.push(`<meta name="keywords" content="${keywords}">`);
    htmlLines.push(`<meta name="author" content="ThingsPool">`);
    htmlLines.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
    htmlLines.push(`<meta property="og:title" content="Free Games"/>`);
    htmlLines.push(`<meta property="og:url" content="https://thingspool.net"/>`);
    htmlLines.push(`<meta property="og:type" content="website"/>`);
    htmlLines.push(`<meta property="og:site_name" content="ThingsPool"/>`);
    htmlLines.push(`<meta property="og:description" content="Play free games on your browser!"/>`);
    htmlLines.push(`<meta property="og:image" content="https://thingspool.net/share.jpg"/>`);
    htmlLines.push(`<meta property="og:image:width" content="1200">`);
    htmlLines.push(`<meta property="og:image:height" content="630">`);

    htmlLines.push(`<!-- Google tag (gtag.js) -->`);
    htmlLines.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=G-JL7KHR7HK8"></script>`);
    htmlLines.push(`<script>`);
    htmlLines.push(`window.dataLayer = window.dataLayer || [];`);
    htmlLines.push(`function gtag(){dataLayer.push(arguments);}`);
    htmlLines.push(`gtag('js', new Date());`);
    htmlLines.push(`gtag('config', 'G-JL7KHR7HK8');`);
    htmlLines.push(`</script>`);
    
    htmlLines.push(`<title>${title}</title>`);
    htmlLines.push(`<link rel="shortcut icon" href="${pageDepthRelativePath}favicon.ico">`);
    htmlLines.push(`<link rel="stylesheet" href="${pageDepthRelativePath}style.css">`);
    htmlLines.push(`<link rel="author" href="https://www.linkedin.com/in/youngjin-kang-55321882">`);
    htmlLines.push(`</head>`);
    htmlLines.push(`<body>`);
}

function addPromo(htmlLines, pageDepth)
{
    let pageDepthRelativePath = "";
    for (let i = 0; i <= pageDepth; ++i)
        pageDepthRelativePath += "../";

    htmlLines.push(`<div class="xl_spacer"></div>`);
    for (const gameEntry of gameEntries)
        addGameLink(htmlLines, gameEntry[1], `${pageDepthRelativePath}${gameEntry[0]}/page.html`, `${gameEntry[0]}/entry.jpg`, pageDepth);
    htmlLines.push(`<div class="xl_spacer"></div>`);
}

function addGameLink(htmlLines, gameTitle, gameURL, imageURL, pageDepth)
{
    let pageDepthRelativePath = "";
    for (let i = 0; i <= pageDepth; ++i)
        pageDepthRelativePath += "../";

    htmlLines.push(`<a class="noTextDeco" href="${gameURL}">`);
    htmlLines.push(`<img class="gameLink" src="${pageDepthRelativePath}${imageURL}" alt="${gameTitle}">`);
    htmlLines.push(`</a>`);
}

function addGamePlayButton(htmlLines, gamePlayURL, pageDepth)
{
    let pageDepthRelativePath = "";
    for (let i = 0; i <= pageDepth; ++i)
        pageDepthRelativePath += "../";

    htmlLines.push(`<a class="noTextDeco" href="${gamePlayURL}">`);
    htmlLines.push(`<img class="playButton" src="${pageDepthRelativePath}play.png" alt="Play">`);
    htmlLines.push(`</a>`);
}

function addFooterHTML(htmlLines, pageDepth)
{
    let pageDepthRelativePath = "";
    for (let i = 0; i <= pageDepth; ++i)
        pageDepthRelativePath += "../";

    htmlLines.push(`<footer>`);
    htmlLines.push(`<a class="noTextDeco" href="https://thingspool.net"><img class="logoImageSmall" src="${pageDepthRelativePath}logo.png" alt="ThingsPool Logo"></a>`);
    htmlLines.push(`&copy 2019-2023 ThingsPool.<br>All rights reserved.<br>Contact: thingspool@gmail.com`);
    htmlLines.push(`</footer>`);
    htmlLines.push(`</body>`);
    htmlLines.push(`</html>`);
}

function createHTMLForGame(gameTitle, gamePlayURL, gameYouTubeTag, rawText)
{
    const htmlLines = [];

    const lines = rawText.split(/\r?\n/);

    let description = "";
    let keywords = "";

    if (lines[0].startsWith(":d:"))
        description = lines[0].substring(3);
    else
        console.error(":d: is missing in -> " + gameTitle);

    if (lines[1].startsWith(":k:"))
        keywords = lines[1].substring(3).toLowerCase().replaceAll("-", " ");
    else
        console.error(":k: is missing in -> " + gameTitle);

    addHeaderHTML(htmlLines, "ThingsPool - " + gameTitle, 0, description, keywords);
    htmlLines.push(`<h3><a href="javascript:history.back()">&#171; Back</a></h3>`);
    htmlLines.push(`<h1>${gameTitle}</h1>`);

    addGamePlayButton(htmlLines, gamePlayURL, 0);

    let imageIndex = 1;
    const paragraphLinesPending = [];

    const endParagraph = () => {
        if (paragraphLinesPending.length > 0)
        {
            htmlLines.push(`<p>${paragraphLinesPending.join("<br>")}</p>`);
            paragraphLinesPending.length = 0;
        }
    };
    
    for (let i = 2; i < lines.length; ++i)
    {
        let line = lines[i];
        line = line.trim();

        if (line.length == 0) // empty line
        {
            endParagraph();
        }
        else if (line.startsWith("[")) // Paragraph Title
        {
            endParagraph();
            const paragraphTitle = line.match(/\[(.*?)\]/)[1].trim();
            if (paragraphTitle.length > 0)
            {
                htmlLines.push(`<h2>${paragraphTitle}</h2>`);
            }
        }
        else if (line.startsWith("<")) // image reference
        {
            endParagraph();
            const imgName = line.match(/<(.*?)>/)[1];
            if (imgName.length > 0)
            {
                const imgPath = `${imgName}.jpg`;
                htmlLines.push(`<img class="gameImage" src="${imgPath}" alt="ThingsPool - ${gameTitle} (Screenshot ${imageIndex++})">`);
            }
        }
        else // plain text
        {
            paragraphLinesPending.push(line);
        }
    }
    endParagraph();
    if (gameYouTubeTag != null && gameYouTubeTag != undefined)
    {
        htmlLines.push(`<div class="l_spacer"></div>`);
        htmlLines.push(gameYouTubeTag);
    }
    addFooterHTML(htmlLines, 0);
    return htmlLines.join("\n");
}

function createHTMLsForWritings(rawText, code)
{
    let isFirstArticle = true;
    let title = "???";
    let fileIndex = 1;
    let imageIndex = 1;
    let snippetOn = false;
    const paragraphLinesPending = [];
    const fileIndices = [];
    const fileTitles = [];
    const fileTexts = [];
    const htmlLines = [];

    let description = "A writing by ThingsPool.";
    let keywords = "ThingsPool, Free, Game, Writing";

    const endParagraph = () => {
        if (paragraphLinesPending.length > 0)
        {
            if (snippetOn)
                htmlLines.push(`<p class="snippet">${paragraphLinesPending.join("<br>").replaceAll(" ", "&nbsp;")}</p>`);
            else
                htmlLines.push(`<p>${paragraphLinesPending.join("<br>")}</p>`);
            paragraphLinesPending.length = 0;
        }
    };

    const lines = rawText.split(/\r?\n/);
    for (let i = 0; i < lines.length; ++i)
    {
        let line = lines[i];
        if (!snippetOn)
            line = line.trim();

        if (line.length == 0) // empty line
        {
            if (snippetOn)
                paragraphLinesPending.push(`<br>`);
            else
                endParagraph();
        }
        else if (line.startsWith("[")) // header
        {
            endParagraph();
            title = line.match(/\[(.*?)\]/)[1].trim();
            fileTitles.push(title);
            const date = line.match(/\](.*?)$/)[1].trim();
            if (!isFirstArticle)
            {
                addFooterHTML(htmlLines, 0);
                fileIndices.push(fileIndex++);
                fileTexts.push(htmlLines.join("\n"));
                htmlLines.length = 0;
                imageIndex = 1;
            }
            isFirstArticle = false;
            addHeaderHTML(htmlLines, title, 0, description, keywords);
            description = "A writing by ThingsPool.";
            keywords = "ThingsPool, Game, Free";
            htmlLines.push(`<h3><a href="list.html">&#171; Back</a></h3>`);
            htmlLines.push(`<h1>${title}</h1>`);
            htmlLines.push(`<h2>${date}</h2>`);
            addPromo(htmlLines, 0);
        }
        else if (line.startsWith("<")) // image reference
        {
            endParagraph();
            const imgName = line.match(/<(.*?)>/)[1];
            if (imgName.length > 0)
            {
                const imgPath = `${imgName}.jpg`;
                htmlLines.push(`<img class="figureImage" src="${imgPath}" alt="${title} (Figure ${imageIndex++})">`);
            }
        }
        else if (line.startsWith("#$")) // snippet
        {
            endParagraph();
            snippetOn = !snippetOn;
        }
        else if (line.startsWith(":d:"))
        {
            description = line.substring(3);
        }
        else if (line.startsWith(":k:"))
        {
            keywords = line.substring(3).toLowerCase().replaceAll("-", " ");
        }
        else if (line.startsWith("_CUT_"))
        {
            break;
        }
        else // plain text
        {
            paragraphLinesPending.push(line);
        }
    }
    endParagraph();
    addFooterHTML(htmlLines, 0);
    fileIndices.push(fileIndex++);
    fileTexts.push(htmlLines.join("\n"));
    htmlLines.length = 0;
    imageIndex = 1;

    return {fileIndices, fileTitles, fileTexts};
}

run();