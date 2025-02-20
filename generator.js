const css = require('./styleDictionary.js');

const fs = require('fs/promises');
const fss = require('fs');

const rootURL = "https://thingspool.net";
const globalLastmod = "2023-09-10";

// [code (directory name), title, play link URL, YouTube URL, lastmod]
const gameEntries = [
    [
        "Water-vs-Fire",
        "Water vs Fire",
        "https://www.gamearter.com/game/water-vs-fire",
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/6DeA_m8Iq4M?si=hC1uzkEtBWpYcM8z" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
        "2023-09-10",
    ],
    [
        "HuntLand",
        "HuntLand",
        "https://www.gamearter.com/game/huntland",
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/3dRg6vvoPqc?si=FlnKVyzQq0_55sL2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
        "2023-09-10",
    ],
    [
        "PoliceChase",
        "Police Chase",
        "https://www.gamearter.com/game/policechase",
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/kABg0j2mZqQ?si=3-JUZQnh3omVXSJd" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
        "2023-09-10",
    ],
    [
        "SpaceTown",
        "SpaceTown",
        "https://www.gamearter.com/game/spacetown",
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/NoiQzEKJM-A?si=o8vTNqW1kxCJ4MnW" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
        "2023-09-20",
    ],
];

const nonfictionEntries = [
    ["metaphysics", "형이상학 (2013 - 2014)"],
    ["game-analysis", "게임분석 (2019)"],
    ["essays", "Miscellaneous Writings (2022 - 2024)"],
    ["blockchains", "On Legitimacy of Blockchains (2022)"],
    ["software-development", "Software Development (2022 - 2024)"],
    ["game-design", "Universal Laws of Game Design (2023)"],
    ["reality", "The Origin of Reality (2023)"],
    ["bridge-to-math", "A Layman's Bridge to Mathematics (2024)"],
    ["morsels", "Morsels of Thought (2024)"],
    ["concepts-of-plan", "Concepts of a Plan (2025)"],
];
const fictionEntries = [
    ["novels", "단편소설 (2012 - 2013)"],
    ["alien-job-interview", "Alien Job Interview (2022)"],
    ["infinite-treasures", "The Island of Infinite Treasures (2022)"],
    ["infsoc", "Influential Social Posts (2023)"],
    ["gamedev-journey", "A Game Developer's Journey (2023)"],
    ["sandwich", "Sandwich Engineering (2025)"],
];
const artEntries = [
    ["illustrations", "Illustrations (2009 - 2014)"],
    ["cartoons", "Cartoons (2011 - 2015)"],
];
const linkEntries = [
    ["read-rec", "Recommended Readings (2024)"],
];

const sitemapLines = [
    `</urlset>`,
];

const feedLines = [
    `</feed>`,
];

globalLatestUpdate = new Date(globalLastmod);

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
        await write(relativeURL, createHTMLForGame(gameEntry[1], gameEntry[2], gameEntry[3], await read(`${gameEntry[0]}/source.txt`), gameEntry[0], relativeURL));
        addSitemapEntry(`${rootURL}/${relativeURL}`, gameEntry[4]);
        addFeedEntry(`${rootURL}/${relativeURL}`, gameEntry[1], gameEntry[4], gameEntry[1]);
    }

    //------------------------------------------------------------------------------------
    // Generate HTMLs for writings
    //------------------------------------------------------------------------------------

    await makeWritingPages(nonfictionEntries);
    await makeWritingPages(fictionEntries);
    await makeWritingPages(artEntries);
    await makeWritingPages(linkEntries);

    //------------------------------------------------------------------------------------
    // Generate index.html
    //------------------------------------------------------------------------------------

    htmlLines.length = 0;
    addHeaderHTML(htmlLines, "ThingsPool", "ThingsPool is an indie game developer.", "thingspool, entertainment, web game, browser game, html5 game rts, fps, boardgame, tabletop game, puzzle game, tactics game, sandbox game", undefined);

    htmlLines.push(`<img class="logoImage" src="${rootURL}/logo.png" alt="ThingsPool Logo">`);
    htmlLines.push(`<div class="l_spacer"></div>`);

    htmlLines.push(`<h1>Featured</h1>`);
    addFeatureLink(htmlLines, "Games in Prolog", "https://thingspool.net/morsels/page-10.html", "https://thingspool.net/feat0.jpg");
    addFeatureLink(htmlLines, "Model of the Mind", "https://thingspool.net/morsels/page-2.html", "https://thingspool.net/feat2.jpg");
    addFeatureLink(htmlLines, "Serious Game Design", "https://thingspool.net/morsels/page-1.html", "https://thingspool.net/feat1.jpg");
    addFeatureLink(htmlLines, "Thought Simulator", "https://thingspool.net/morsels/page-3.html", "https://thingspool.net/feat3.jpg");
    htmlLines.push(`<div class="l_spacer"></div>`);

    makeWritingPagesList("Writings (Nonfiction)", nonfictionEntries, htmlLines);
    htmlLines.push(`<div class="l_spacer"></div>`);

    makeWritingPagesList("Writings (Fiction)", fictionEntries, htmlLines);
    htmlLines.push(`<div class="l_spacer"></div>`);

    makeWritingPagesList("Recommendations", linkEntries, htmlLines);
    htmlLines.push(`<div class="l_spacer"></div>`);

    makeWritingPagesList("Arts", artEntries, htmlLines);
    htmlLines.push(`<div class="l_spacer"></div>`);

    htmlLines.push(`<h1>Games</h1>`);
    addPromo(htmlLines);
    htmlLines.push(`<div class="l_spacer"></div>`);

    htmlLines.push(`<h1>About Myself</h1>`);
    htmlLines.push(`<img class="profileImage" src="${rootURL}/profile.jpg" alt="Youngjin Kang">`);
    htmlLines.push(`<div class="m_spacer"></div>`);
    htmlLines.push(`<h3>Hello!</h3>`);
    htmlLines.push(`<p>My name is Youngjin, and I am a software engineer who develops computer games, simulations, and other types of interactive media. I studied electrical and electronics engineering at the University of Washington, and worked as a software developer in game development companies including Signal Studios (Bothell, WA), Valkyrie Entertainment (Seattle, WA), and Galactic Entertainment (United Kingdom).</p>`);
    htmlLines.push(`<p>ThingsPool is an independent game development studio which I have founded for the purpose of making and publishing videogames that are easily accessible and furnished with unique personalities.</p>`);
    htmlLines.push(`<p>Besides games, however, there are also a wide variety of arts, novels, and treatises available here. I recommend you to take a look at them if you are interested in philosophy, mathematics, engineering, literature, and other multidisciplinary topics.</p>`);
    htmlLines.push(`<div class="m_spacer"></div>`);
    htmlLines.push(`<h3><a href="${rootURL}/youngjin_resume.pdf">Resume</a></h3>`);
    htmlLines.push(`<h3><a href="https://www.linkedin.com/in/youngjin-kang-55321882">LinkedIn Profile</a></h3>`);
    htmlLines.push(`<h3><a href="https://github.com/architsch">GitHub Profile</a></h3>`);
    htmlLines.push(`<h3><a href="https://www.pacogames.com/developers/thingspool">PacoGames Profile</a></h3>`);

    addFooterHTML(htmlLines);
    relativeURL = `index.html`;
    await write(relativeURL, htmlLines.join("\n"));
    addSitemapEntry(rootURL, globalLastmod);

    //------------------------------------------------------------------------------------
    // Generate sitemap.xml
    //------------------------------------------------------------------------------------

    sitemapLines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    sitemapLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    sitemapLines.reverse();
    await write(`sitemap.xml`, sitemapLines.join("\n"));

    //------------------------------------------------------------------------------------
    // Generate atom.xml
    //------------------------------------------------------------------------------------

    feedLines.push(`<id>urn:uuid:02210672-5391-4cc8-800a-2a88f3a6d00c</id>`); // uuid randomly generated
    feedLines.push(`</author>`);
    feedLines.push(`  <name>Youngjin Kang</name>`);
    feedLines.push(`<author>`);
    feedLines.push(`<updated>${globalLatestUpdate.toISOString()}</updated>`);
    feedLines.push(`<link href="${rootURL}"/>`);
    feedLines.push(`<link rel="self" type="application/atom+xml" href="${rootURL}/feed.atom"/>`);
    feedLines.push(`<title>ThingsPool</title>`);
    feedLines.push(`<feed xmlns="http://www.w3.org/2005/Atom">`);
    feedLines.push(`<?xml version="1.0" encoding="utf-8"?>`);
    feedLines.reverse();
    await write(`feed.atom`, feedLines.join("\n"));
}

function makeWritingPagesList(title, writingEntries, htmlLines)
{
    htmlLines.push(`<h1>${title}</h1>`);

    writingEntries.reverse();

    for (let i = 0; i < writingEntries.length; ++i)
    {
        const code = writingEntries[i][0];
        const entryName = writingEntries[i][1];
        htmlLines.push(`<a class="listEntry" href="${rootURL}/${code}/list.html">${entryName}</a>`);
    }
}

async function makeWritingPages(writingEntries)
{
    const htmlLines = [];
    for (let i = 0; i < writingEntries.length; ++i)
    {
        const code = writingEntries[i][0];
        const listRelativeURL = `${code}/list.html`;

        const entryTitle = writingEntries[i][1];
        const rawText = await read(`${code}/source.txt`);
        const {fileIndices, fileTitles, fileTexts, fileLastmods, fileDescs} = createHTMLsForWritings(rawText, code);

        htmlLines.length = 0;
        addHeaderHTML(htmlLines, "ThingsPool - " + entryTitle, entryTitle, "thingspool, web game, browser game, html5 game, blog, writings, articles", listRelativeURL);
        htmlLines.push(`<div class="l_spacer"></div>`);
        htmlLines.push(`<a class="homeButton" href="${rootURL}">Home</a>`);
        htmlLines.push(`<h1>${entryTitle}</h1>`);
        htmlLines.push(`<div class="l_spacer"></div>`);

        for (let j = fileIndices.length-1; j >= 0; --j)
        {
            const fileIndex = fileIndices[j];
            const fileTitle = fileTitles[j];
            const fileText = fileTexts[j];
            const fileLastmod = fileLastmods[j];
            const fileDesc = fileDescs[j];
            const fileHTMLFileName = `page-${fileIndex}.html`;
            htmlLines.push(`<a class="listEntry" href="${rootURL}/${code}/${fileHTMLFileName}">${fileTitle}</a>`);

            const entryRelativeURL = `${code}/${fileHTMLFileName}`;
            await write(entryRelativeURL, fileText);
            addSitemapEntry(`${rootURL}/${entryRelativeURL}`, fileLastmod);
            addFeedEntry(`${rootURL}/${entryRelativeURL}`, fileTitle, fileLastmod, fileDesc);
        }
        htmlLines.push(`<a class="listEntry" href="${rootURL}">... Other Works</a>`);
        addFooterHTML(htmlLines);

        await write(listRelativeURL, htmlLines.join("\n"));
        addSitemapEntry(`${rootURL}/${listRelativeURL}`, fileLastmods.sort().pop());
    }
}

async function read(filepath, rootDir = "public")
{
    try
    {
        const data = await fs.readFile(`./${rootDir}/` + filepath, {encoding: 'utf8'});
        return data;
    }
    catch (err)
    {
        console.error(err);
        return "";
    }
}

async function write(filepath, content, rootDir = "public")
{
    try
    {
        await fs.writeFile(`./${rootDir}/` + filepath, content);
    }
    catch (err)
    {
        console.error(err);
    }
}

async function copyFile(sourcePath, targetPath, rootDir = "public")
{
    try
    {
        await fs.copyFile(`./${rootDir}/` + sourcePath, `./${rootDir}/` + targetPath);
    }
    catch (err)
    {
        console.error(err);
    }
}

async function mkdir(fileOrDirPath, rootDir = "public")
{
    try
    {
        if (!fss.existsSync(`./${rootDir}/` + fileOrDirPath))
            await fs.mkdir(`./${rootDir}/` + fileOrDirPath);
    }
    catch (err)
    {
        console.error(err);
    }
}

function addSitemapEntry(url, lastmod)
{
    sitemapLines.push(`</url>`);
    sitemapLines.push(`<lastmod>${lastmod}</lastmod>`);
    sitemapLines.push(`<loc>${url}</loc>`);
    sitemapLines.push(`<url>`);
}

function addFeedEntry(url, title, lastmod, description)
{
    let date = new Date(lastmod);
    if (date > globalLatestUpdate) { globalLatestUpdate = date; }

    feedLines.push(`</entry>`);
    feedLines.push(`  <summary>${description}</summary>`);
    feedLines.push(`  <updated>${date.toISOString()}</updated>`);
    feedLines.push(`  <id>${url}</id>`); // not ideal to use the url as unique never changing id but there is no other id for each article.
    feedLines.push(`  <link href="${url}"/>`);
    feedLines.push(`  <title>${title}</title>`);
    feedLines.push(`<entry>`);
}

function addHeaderHTML(htmlLines, title, description, keywords, relativePageURL, ogImageURLOverride)
{
    title = title.replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    description = description.replaceAll("\"", "&quot;");
    keywords = keywords.replaceAll("\"", "&quot;");

    htmlLines.push(`<!DOCTYPE html>`);
    htmlLines.push(`<html>`);
    htmlLines.push(`<head>`);
    htmlLines.push(`<meta charset="utf-8">`);
    htmlLines.push(`<meta name="description" content="${description}">`);
    htmlLines.push(`<meta name="keywords" content="${keywords}">`);
    htmlLines.push(`<meta name="author" content="Youngjin Kang">`);
    htmlLines.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
    htmlLines.push(`<meta property="og:title" content="${title}"/>`);

    if (relativePageURL != undefined)
        htmlLines.push(`<meta property="og:url" content="${rootURL}/${relativePageURL}"/>`);
    else
        htmlLines.push(`<meta property="og:url" content="${rootURL}"/>`);

    if (relativePageURL != undefined)
        htmlLines.push(`<meta property="og:type" content="article"/>`);
    else
        htmlLines.push(`<meta property="og:type" content="website"/>`);

    htmlLines.push(`<meta property="og:site_name" content="ThingsPool"/>`);
    htmlLines.push(`<meta property="og:description" content="${description}"/>`);

    if (ogImageURLOverride != undefined)
        htmlLines.push(`<meta property="og:image" content="${ogImageURLOverride}"/>`);
    else
        htmlLines.push(`<meta property="og:image" content="https://thingspool.net/share.jpg"/>`);

    htmlLines.push(`<meta property="og:image:alt" content="${title}">`);

    htmlLines.push(`<!-- Google tag (gtag.js) -->`);
    htmlLines.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=G-JL7KHR7HK8"></script>`);
    htmlLines.push(`<script>`);
    htmlLines.push(`window.dataLayer = window.dataLayer || [];`);
    htmlLines.push(`function gtag(){dataLayer.push(arguments);}`);
    htmlLines.push(`gtag('js', new Date());`);
    htmlLines.push(`gtag('config', 'G-JL7KHR7HK8');`);
    htmlLines.push(`</script>`);
    
    htmlLines.push(`<title>${title}</title>`);
    htmlLines.push(`<link rel="shortcut icon" href="${rootURL}/favicon.ico">`);
    htmlLines.push(`<link rel="stylesheet" href="${rootURL}/style.css">`);
    htmlLines.push(`<link rel="author" href="https://www.linkedin.com/in/youngjin-kang-55321882">`);
    htmlLines.push(`<link rel="alternate" type="application/atom+xml" href="${rootURL}/feed.atom" title="Atom Feed">`);

    if (relativePageURL != undefined)
        htmlLines.push(`<link rel="canonical" href="${rootURL}/${relativePageURL}">`);

    htmlLines.push(`</head>`);
    htmlLines.push(`<body>`);
}

function addPromo(htmlLines)
{
    for (const gameEntry of gameEntries)
        addGameLink(htmlLines, gameEntry[1], `${rootURL}/${gameEntry[0]}/page.html`, `${rootURL}/${gameEntry[0]}/entry.jpg`);
}

function addGameLink(htmlLines, gameTitle, gameURL, imageURL)
{
    htmlLines.push(`<a class="noTextDeco" href="${gameURL}">`);
    htmlLines.push(`<img class="gameLink" src="${imageURL}" alt="${gameTitle}">`);
    htmlLines.push(`</a>`);
}

function addFeatureLink(htmlLines, featureTitle, featureURL, imageURL)
{
    htmlLines.push(`<a class="noTextDeco" href="${featureURL}">`);
    htmlLines.push(`<img class="featureLink" src="${imageURL}" alt="${featureTitle}">`);
    htmlLines.push(`</a>`);
}

function addGamePlayButton(htmlLines, gamePlayURL)
{
    htmlLines.push(`<a class="noTextDeco" href="${gamePlayURL}">`);
    htmlLines.push(`<img class="playButton" src="${rootURL}/play.png" alt="Play">`);
    htmlLines.push(`</a>`);
}

function addFooterHTML(htmlLines)
{
    htmlLines.push(`<footer>`);
    htmlLines.push(`<a class="noTextDeco" href="${rootURL}"><img class="logoImageSmall" src="${rootURL}/logo.png" alt="ThingsPool Logo"></a>`);
    htmlLines.push(`&copy 2019-2025 ThingsPool.<br>All rights reserved.`);
    htmlLines.push(`</footer>`);
    htmlLines.push(`</body>`);
    htmlLines.push(`</html>`);
}

function createHTMLForGame(gameTitle, gamePlayURL, gameYouTubeTag, rawText, code, relativePageURL)
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

    addHeaderHTML(htmlLines, "ThingsPool - " + gameTitle, description, keywords, relativePageURL);
    htmlLines.push(`<div class="l_spacer"></div>`);
    htmlLines.push(`<a class="homeButton" href="${rootURL}">Home</a>`);
    htmlLines.push(`<h1>${gameTitle}</h1>`);

    addGamePlayButton(htmlLines, gamePlayURL);

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
                const imgPath = `${rootURL}/${code}/${imgName}.jpg`;
                htmlLines.push(`<img class="gameImage" src="${imgPath}" alt="ThingsPool - ${gameTitle} (Screenshot ${imageIndex++})">`);
            }
        }
        else // plain text
        {
            line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
            paragraphLinesPending.push(line);
        }
    }
    endParagraph();
    if (gameYouTubeTag != null && gameYouTubeTag != undefined)
    {
        htmlLines.push(`<div class="l_spacer"></div>`);
        htmlLines.push(gameYouTubeTag);
    }
    addFooterHTML(htmlLines);
    return htmlLines.join("\n");
}

function createHTMLsForWritings(rawText, code)
{
    let isFirstArticle = true;
    let title = "???";
    let fileIndex = 1;
    let imageIndex = 1;
    let chosenImgPath = undefined;
    let snippetOn = false;
    let excerptOn = false;
    const paragraphLinesPending = [];
    const fileIndices = [];
    const fileTitles = [];
    const fileTexts = [];
    const fileLastmods = [];
    const fileDescs = [];
    const htmlLines = [];
    const htmlLines_header = [];

    let description = "A writing by ThingsPool.";
    let keywords = "thingspool, free game, web game, html5 game, browser game, writing, article";
    let lastmod = globalLastmod;

    let prev_title = title;
    let prev_description = description;
    let prev_keywords = keywords;
    let prev_lastmod = lastmod;

    const endParagraph = () => {
        if (paragraphLinesPending.length > 0)
        {
            if (snippetOn)
                htmlLines.push(`<div class="snippet"><pre><code>${paragraphLinesPending.join("\n")}</code></pre></div>`);
            else if (excerptOn)
                htmlLines.push(`<pre><div class="excerpt">${paragraphLinesPending.join("\n")}</div></pre>`);
            else
                htmlLines.push(`<p>${paragraphLinesPending.join("<br>")}</p>`);
            paragraphLinesPending.length = 0;
        }
    };

    const lines = rawText.split(/\r?\n/);
    for (let i = 0; i < lines.length; ++i)
    {
        let line = lines[i];
        if (!snippetOn && !excerptOn)
            line = line.trim();

        if (line.length == 0) // empty line
        {
            if (snippetOn || excerptOn)
                paragraphLinesPending.push("\n");
            else
                endParagraph();
        }
        else if (line.startsWith("[")) // header
        {
            endParagraph();
            if (!isFirstArticle)
                prev_title = title;
            title = line.match(/\[(.*?)\]/)[1].trim();
            fileTitles.push(title);
            const date = line.match(/\](.*?)$/)[1].trim();
            if (!isFirstArticle)
            {
                htmlLines_header.length = 0;
                addHeaderHTML(htmlLines_header, prev_title, prev_description, prev_keywords, `${code}/page-${fileIndex}.html`, chosenImgPath);
                prev_description = description;
                prev_keywords = keywords;
                prev_lastmod = lastmod;

                addFooterHTML(htmlLines);
                fileIndices.push(fileIndex++);
                fileTexts.push(htmlLines_header.join("\n") + "\n" + htmlLines.join("\n"));
                htmlLines.length = 0;
                imageIndex = 1;
                chosenImgPath = undefined;
            }
            isFirstArticle = false;

            fileLastmods.push(lastmod);
            fileDescs.push(description);

            htmlLines.push(`<div class="l_spacer"></div>`);
            htmlLines.push(`<a class="homeButton" href="${rootURL}/${code}/list.html">Back to List</a>`);
            htmlLines.push(`<h1>${title}</h1>`);

            htmlLines.push(`<h3 style="color:#707070">Author: Youngjin Kang</h3>`);
            htmlLines.push(`<h3 style="color:#707070">Date: ${date}</h3>`);

            htmlLines.push(`<div class="l_spacer"></div>`);
        }
        else if (line.startsWith("<") && !snippetOn && !excerptOn) // image reference
        {
            endParagraph();
            const imgName = line.match(/<(.*?)>/)[1];
            if (imgName.length > 0)
            {
                const imgPath = `${rootURL}/${code}/${imgName}.jpg`;
                if (chosenImgPath == undefined || line.endsWith("*"))
                    chosenImgPath = imgPath;
                htmlLines.push(`<img class="figureImage" src="${imgPath}" alt="${title.replaceAll("\"", "&quot;")} (Figure ${imageIndex++})">`);
            }
        }
        else if (line.startsWith("@@")) // Custom HTML tag
        {
            htmlLines.push(line.substring(2));
        }
        else if (line.startsWith("#$")) // snippet
        {
            endParagraph();
            snippetOn = !snippetOn;
        }
        else if (line.startsWith("#\"")) // excerpt
        {
            endParagraph();
            excerptOn = !excerptOn;
        }
        else if (line.startsWith(":d:"))
        {
            if (!isFirstArticle)
                prev_description = description;
            description = line.substring(3);
        }
        else if (line.startsWith(":k:"))
        {
            if (!isFirstArticle)
                prev_keywords = keywords;
            keywords = line.substring(3).toLowerCase().replaceAll("-", " ");
        }
        else if (line.startsWith(":l:"))
        {
            if (!isFirstArticle)
                prev_lastmod = lastmod;
            lastmod = line.substring(3);
        }
        else // plain text
        {
            line = line.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{%", "<").replaceAll("%}", ">");
            paragraphLinesPending.push(line);
        }
    }
    endParagraph();

    htmlLines_header.length = 0;
    addHeaderHTML(htmlLines_header, title, description, keywords, `${code}/page-${fileIndex}.html`, chosenImgPath);

    addFooterHTML(htmlLines);
    fileIndices.push(fileIndex++);
    fileTexts.push(htmlLines_header.join("\n") + "\n" + htmlLines.join("\n"));
    htmlLines.length = 0;
    imageIndex = 1;
    chosenImgPath = undefined;

    return {fileIndices, fileTitles, fileTexts, fileLastmods, fileDescs};
}

run();
